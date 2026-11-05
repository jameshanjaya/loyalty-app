CREATE TABLE outlet_staff (
  outlet_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (outlet_id, member_id)
);

CREATE INDEX idx_outlet_staff_member ON outlet_staff(member_id);
