SET @row_num := 0;
UPDATE `clients`
SET `clientCode` = CONCAT('CL-', LPAD(@row_num := @row_num + 1, 4, '0'))
WHERE `clientCode` IS NULL
ORDER BY `createdAt` ASC, `id` ASC;
