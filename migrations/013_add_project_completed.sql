-- migrations/013_add_project_completed.sql
-- Add completed status to projects table

ALTER TABLE projects
ADD COLUMN completed boolean NOT NULL DEFAULT false;

CREATE INDEX idx_projects_completed ON projects(completed);

