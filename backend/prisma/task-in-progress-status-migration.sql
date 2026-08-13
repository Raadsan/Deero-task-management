ALTER TABLE `tasks`
  MODIFY COLUMN `status` ENUM('pending', 'in_progress', 'overdue', 'completed') NOT NULL;