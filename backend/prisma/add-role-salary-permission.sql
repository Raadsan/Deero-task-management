ALTER TABLE `roles`
  ADD COLUMN `canViewSalary` BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE `roles`
SET `canViewSalary` = TRUE
WHERE LOWER(`name`) = 'superadmin';
