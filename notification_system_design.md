# Notification System Design

## Stage 1 — REST API Design

### Core Endpoints

**Get all notifications for a student**

GET /api/notifications/:studentID
Headers: { Authorization: Bearer <token> }
Response 200:
{
  "notifications": [
    {
      "id": "uuid",
      "studentID": "uuid",
      "type": "Placement" | "Result" | "Event",
      "message": "string",
      "isRead": false,
      "createdAt": "2026-04-22T17:51:30Z"
    }
  ]
}

**Mark notification as read**

PATCH /api/notifications/:id/read
Headers: { Authorization: Bearer <token> }
Response 200: { "success": true, "message": "Notification marked as read" }

**Send a notification**

POST /api/notifications
Headers: { Authorization: Bearer <token>, Content-Type: application/json }
Body: { "studentID": "uuid", "type": "Placement", "message": "TCS hiring drive" }
Response 201: { "success": true, "notificationID": "uuid" }

**Get unread count**

GET /api/notifications/:studentID/unread-count
Response 200: { "unreadCount": 12 }

### Real-time Mechanism
Using WebSockets (Socket.io). When a notification is saved to DB, the server emits an event to the student's socket room. The frontend listens and updates the UI instantly without polling.

---

## Stage 2 — Database Design

### Recommended DB: PostgreSQL
Relational data fits here — students have many notifications, queries filter by studentID + isRead + type.

### Schema

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TYPE notification_type AS ENUM ('Placement', 'Result', 'Event');

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

### Problems as data grows (50k students, 5M notifications)
- Full table scans on unread queries become slow
- No indexes means O(n) lookup every time
- SELECT * fetches unnecessary columns

### Solutions
- Add composite index on (student_id, is_read)
- Add index on created_at for sorting
- Use pagination with LIMIT and OFFSET
- Partition notifications table by created_at monthly

### Queries

Fetch unread notifications for a student:

SELECT id, type, message, created_at
FROM notifications
WHERE student_id = $1 AND is_read = false
ORDER BY created_at DESC
LIMIT 20;

Students who got a placement notification in last 7 days:

SELECT DISTINCT student_id
FROM notifications
WHERE type = 'Placement'
AND created_at >= NOW() - INTERVAL '7 days';

---

## Stage 3 — Query Analysis

### Original query:

SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;

### Is it accurate?
Yes it is functionally correct but has performance issues.

### Why is it slow?
- SELECT * fetches all columns including unnecessary ones
- No index on studentID and isRead means full table scan on 5 million rows
- No LIMIT so it returns everything at once

### Fixed query:

SELECT id, type, message, created_at
FROM notifications
WHERE student_id = 1042 AND is_read = false
ORDER BY created_at DESC
LIMIT 20;

### Index to add:

CREATE INDEX idx_notifications_student_unread
ON notifications(student_id, is_read, created_at DESC);

Cost goes from O(n) full table scan to O(log n) index lookup.

### Is indexing every column a good idea?
No. Each index adds write overhead — every INSERT and UPDATE must update all indexes. With 5 million rows and frequent inserts this causes serious slowdown. Only index columns used in WHERE and ORDER BY clauses.

---

## Stage 4 — Performance Under Load

### Problem
Fetching from DB on every page load for 50,000 students is hammering the database.

### Solutions and Tradeoffs

**1. Redis Caching**
Cache unread notifications per student with TTL of 60 seconds.
Tradeoff: slight staleness, user may not see newest notification for up to 60 seconds.
Best for read-heavy workloads.

**2. WebSocket Push instead of Polling**
Instead of fetching on page load, push new notifications to client in real-time.
Tradeoff: requires persistent connections and more server memory.
Eliminates unnecessary DB reads entirely.

**3. Pagination**
Never fetch all notifications at once, use LIMIT and OFFSET.
Tradeoff: UX needs infinite scroll or pagination controls.

**4. Read Replicas**
Route all SELECT queries to a read replica.
Tradeoff: replication lag and added infrastructure cost.

**Recommended combination:** Redis cache + WebSocket push + pagination

---

## Stage 5 — Bulk Notification Reliability

### Problem with original pseudocode

function notify_all(student_ids, message):
    for student_id in student_ids:
        send_email(student_id, message)
        save_to_db(student_id, message)
        push_to_app(student_id, message)

- Sequential loop means 50,000 API calls one by one which is extremely slow
- If send_email fails at student 200, the remaining 49,800 students get nothing
- DB save and email are tightly coupled so if email fails DB never saves

### Should DB save and email happen together?
No. Decouple them. Save to DB first as the source of truth, then trigger email async via a queue. If email fails the DB record still exists and retry is possible.

### Redesigned pseudocode

function notify_all(student_ids, message):
    // Step 1 - bulk insert all notifications to DB first
    bulk_insert_notifications(student_ids, message)

    // Step 2 - push all jobs to a message queue
    for student_id in student_ids:
        queue.add({ student_id, message })

// Queue worker runs in parallel with multiple workers
worker.process(async (job):
    send_email(job.student_id, job.message)   // retried automatically on failure
    push_to_app(job.student_id, job.message)
)

### Why this works
- Bulk DB insert is fast
- Queue workers process in parallel not sequentially
- Failed emails are retried automatically by the queue
- 200 failed emails do not affect the remaining 49,800 students

---

## Stage 6 — Priority Inbox

See notification_app_be/priorityInbox.js for implementation.

### Approach
Priority score = type weight + recency score
- Placement = weight 3
- Result = weight 2
- Event = weight 1
- Recency = newer notifications scored higher using timestamp difference

### Maintaining top 10 as new notifications arrive
Use a Min-Heap of size 10. When a new notification comes in compare its priority with the heap minimum. If higher replace it. This gives O(log 10) per new notification which is effectively constant time.