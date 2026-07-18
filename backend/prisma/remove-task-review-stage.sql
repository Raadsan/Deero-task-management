UPDATE `tasks`
SET `workflowStage` = 'in_progress'
WHERE `workflowStage` = 'review';

UPDATE `workflow_template_steps`
SET `workflowStage` = 'in_progress'
WHERE `workflowStage` = 'review';

ALTER TABLE `tasks`
  MODIFY `workflowStage` ENUM('pending', 'in_progress', 'completed', 'blocked')
  NOT NULL DEFAULT 'pending';

ALTER TABLE `workflow_template_steps`
  MODIFY `workflowStage` ENUM('pending', 'in_progress', 'completed', 'blocked')
  NOT NULL DEFAULT 'pending';
