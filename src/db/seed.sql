INSERT OR IGNORE INTO packages (
  service_type,
  sessions,
  duration_months,
  price,
  consistency_window_days,
  consistency_min_days
) VALUES
  ('1:1 Personal Training',             8, 1, 19900, 7, 2),
  ('1:1 Personal Training',            12, 1, 29500, 7, 3),
  ('1:1 Personal Training',            24, 3, 59000, 7, 2),
  ('1:1 Personal Training',            36, 3, 85800, 7, 3),
  ('MMA/Kickboxing Personal Training',  4, 1,  9600, 7, 1),
  ('MMA/Kickboxing Personal Training',  8, 1, 18800, 7, 2),
  ('MMA/Kickboxing Personal Training', 12, 1, 26400, 7, 3),
  ('Group Personal Training',          12, 1, 14500, 7, 3),
  ('Group Personal Training',          16, 1, 18900, 7, 4),
  ('Group Personal Training',          36, 3, 42000, 7, 3),
  ('Group Personal Training',          48, 3, 54000, 7, 4),
  ('Group Personal Training',          16, 2, 22800, 7, 2),
  ('Group Personal Training',          30, 4, 42500, 7, 2),
  ('Group Personal Training',          40, 5, 56000, 7, 2);
