CREATE TABLE IF NOT EXISTS `project_service_links` (
  `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `projectId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `serviceId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_service_links_project_service` (`projectId`, `serviceId`),
  KEY `project_service_links_serviceId` (`serviceId`),
  CONSTRAINT `project_service_links_project_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_service_links_service_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services` (`id`)
);

CREATE TABLE IF NOT EXISTS `project_sub_services` (
  `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `projectServiceId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `unit` VARCHAR(64) NOT NULL DEFAULT 'Items',
  `targetQuantity` INTEGER NOT NULL DEFAULT 1,
  `assigneeId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  PRIMARY KEY (`id`),
  KEY `project_sub_services_link` (`projectServiceId`),
  KEY `project_sub_services_assignee` (`assigneeId`),
  CONSTRAINT `project_sub_services_link_fkey` FOREIGN KEY (`projectServiceId`) REFERENCES `project_service_links` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_sub_services_assignee_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `staffs` (`id`) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS `project_cycles` (
  `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `projectId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` VARCHAR(64) NOT NULL,
  `startDate` DATETIME(3) NOT NULL,
  `endDate` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `project_cycles_projectId` (`projectId`),
  CONSTRAINT `project_cycles_project_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `project_extra_requests` (
  `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `projectId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `subServiceId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` INTEGER NOT NULL,
  `description` TEXT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  `requestedById` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `project_extra_requests_project` (`projectId`),
  KEY `project_extra_requests_sub` (`subServiceId`),
  CONSTRAINT `project_extra_requests_project_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_extra_requests_sub_fkey` FOREIGN KEY (`subServiceId`) REFERENCES `project_sub_services` (`id`),
  CONSTRAINT `project_extra_requests_user_fkey` FOREIGN KEY (`requestedById`) REFERENCES `staffs` (`id`) ON DELETE SET NULL
);
