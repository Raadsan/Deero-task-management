ALTER TABLE `staffs` RENAME COLUMN `branchId` TO `portfolioId`;
ALTER TABLE `clients` RENAME COLUMN `branchId` TO `portfolioId`;
ALTER TABLE `services` RENAME COLUMN `branchId` TO `portfolioId`;
ALTER TABLE `projects` RENAME COLUMN `branchId` TO `portfolioId`;
ALTER TABLE `contracts` RENAME COLUMN `branchId` TO `portfolioId`;
ALTER TABLE `content_requests` RENAME COLUMN `branchId` TO `portfolioId`;
ALTER TABLE `recurring_schedules` RENAME COLUMN `branchId` TO `portfolioId`;
