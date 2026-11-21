-- Extend task status enum to six official values (safe for existing rows).
ALTER TABLE `tasks`
  MODIFY `status` ENUM(
    'pending',
    'in_progress',
    'pending_review',
    'overdue',
    'on_hold',
    'completed'
  ) NOT NULL;