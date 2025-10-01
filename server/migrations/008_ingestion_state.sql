-- Migration 008: Ingestion Progress State Machine
-- Phase C - E-C6: State Management for Resumable Processes

CREATE TABLE IF NOT EXISTS ingestion_state (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(255) NOT NULL UNIQUE,
    state VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    current_step INTEGER NOT NULL DEFAULT 0,
    total_steps INTEGER NOT NULL DEFAULT 0,
    processed_records INTEGER NOT NULL DEFAULT 0,
    total_records INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    checkpoint_data JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- State constraints
    CONSTRAINT valid_state CHECK (state IN (
        'PENDING', 'PROCESSING', 'PAUSED', 'FAILED', 
        'COMPLETED', 'ROLLBACK', 'CANCELLED'
    )),
    CONSTRAINT valid_progress CHECK (
        processed_records >= 0 AND 
        processed_records <= total_records AND
        current_step >= 0 AND 
        current_step <= total_steps
    )
);

-- Index for efficient state queries
CREATE INDEX IF NOT EXISTS idx_ingestion_state_batch_id ON ingestion_state(batch_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_state_state ON ingestion_state(state);
CREATE INDEX IF NOT EXISTS idx_ingestion_state_updated_at ON ingestion_state(updated_at);

-- Table for process step definitions
CREATE TABLE IF NOT EXISTS process_steps (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(255) NOT NULL,
    step_number INTEGER NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    step_type VARCHAR(100) NOT NULL,
    step_config JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (batch_id) REFERENCES ingestion_state(batch_id) ON DELETE CASCADE,
    
    CONSTRAINT valid_step_status CHECK (status IN (
        'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED'
    )),
    CONSTRAINT unique_batch_step UNIQUE (batch_id, step_number)
);

-- Index for step queries
CREATE INDEX IF NOT EXISTS idx_process_steps_batch_id ON process_steps(batch_id);
CREATE INDEX IF NOT EXISTS idx_process_steps_status ON process_steps(status);

-- Updated timestamp trigger for ingestion_state
CREATE OR REPLACE FUNCTION update_ingestion_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ingestion_state_timestamp
    BEFORE UPDATE ON ingestion_state
    FOR EACH ROW
    EXECUTE FUNCTION update_ingestion_state_timestamp();

-- Sample data for testing
INSERT INTO ingestion_state (batch_id, state, total_steps, total_records, checkpoint_data) VALUES 
('test-batch-001', 'PENDING', 5, 1000, '{"last_processed_id": 0, "checkpoint_table": "invoices"}'),
('test-batch-002', 'PROCESSING', 3, 500, '{"last_processed_id": 250, "current_table": "payments"}'),
('test-batch-003', 'COMPLETED', 4, 200, '{"completion_time": "2025-09-30T12:00:00Z"}')
ON CONFLICT (batch_id) DO NOTHING;

INSERT INTO process_steps (batch_id, step_number, step_name, step_type, step_config, status) VALUES 
('test-batch-001', 1, 'Validate Input Data', 'VALIDATION', '{"schema": "invoice_schema"}', 'PENDING'),
('test-batch-001', 2, 'Process Invoices', 'TRANSFORM', '{"batch_size": 100}', 'PENDING'),
('test-batch-001', 3, 'Update Representatives', 'UPDATE', '{"update_debt": true}', 'PENDING'),
('test-batch-001', 4, 'Generate Reports', 'REPORT', '{"format": "json"}', 'PENDING'),
('test-batch-001', 5, 'Cleanup Temp Data', 'CLEANUP', '{"temp_tables": ["temp_invoices"]}', 'PENDING'),

('test-batch-002', 1, 'Load Payment Data', 'LOAD', '{"source": "bank_file"}', 'COMPLETED'),
('test-batch-002', 2, 'Allocate Payments', 'PROCESS', '{"allocation_strategy": "oldest_first"}', 'PROCESSING'),
('test-batch-002', 3, 'Notify Representatives', 'NOTIFICATION', '{"channels": ["telegram", "email"]}', 'PENDING')
ON CONFLICT (batch_id, step_number) DO NOTHING;