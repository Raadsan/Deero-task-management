ALTER TABLE `tasks` ADD COLUMN `extraTimeMinutes` INT NOT NULL DEFAULT 0 AFTER `deadline`,
  ADD COLUMN `completedAt` DATETIME(3) NULL AFTER `extraTimeMinutes`,
  ADD COLUMN `progressUpdatedAt` DATETIME(3) NULL AFTER `completedAt`;
