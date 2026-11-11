IF OBJECT_ID(N'dbo.tasks', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.tasks (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_daybook_tasks PRIMARY KEY,
    title NVARCHAR(90) NOT NULL,
    category NVARCHAR(16) NOT NULL
      CONSTRAINT CK_daybook_tasks_category CHECK (category IN (N'Work', N'Personal', N'Errands', N'Ideas')),
    priority VARCHAR(6) NOT NULL CONSTRAINT DF_daybook_tasks_priority DEFAULT 'medium'
      CONSTRAINT CK_daybook_tasks_priority CHECK (priority IN ('high', 'medium', 'low')),
    due_at DATETIME2(0) NULL,
    is_done BIT NOT NULL CONSTRAINT DF_daybook_tasks_done DEFAULT 0,
    is_alerted BIT NOT NULL CONSTRAINT DF_daybook_tasks_alerted DEFAULT 0,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_daybook_tasks_created DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_daybook_tasks_updated DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_daybook_tasks_created_at ON dbo.tasks (created_at DESC);
  CREATE INDEX IX_daybook_tasks_due_at ON dbo.tasks (due_at);
END;