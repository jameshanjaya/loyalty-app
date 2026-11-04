export type Brand = {
  id: string;
  name: string;
  short_name: string;
  handle: string;
  emoji: string;
  accent: string;
  accent_soft: string;
  stamps_required: number;
  reward_text: string;
  condition_label: string;
  min_amount: number | null;
  max_stamps_per_day: number;
  reward_note: string;
  active: number;
  birthday_reward: string;
  birthday_active: number;
  birthday_window: string;
  birthday_days: number;
};

export type Outlet = {
  id: string;
  brand_id: string;
  name: string;
  pin_hash: string;
  pin_salt: string;
  wa: string;
  active: number;
  created_at: number;
};

export type Member = {
  id: string;
  name: string;
  wa: string;
  pin_hash: string;
  pin_salt: string;
  created_at: number;
  last_seen_at: number;
  email: string | null;
  birthday: string | null;
  google_sub: string | null;
  join_method: string;
};

export type Card = {
  member_id: string;
  brand_id: string;
  stamps: number;
  lifetime_stamps: number;
  lifetime_redeems: number;
  day_count: number;
  day_on: number;
  updated_at: number;
};

export type SessionRow = {
  id: string;
  kind: string;
  subject_id: string | null;
  created_at: number;
  expires_at: number;
};

export type Banner = {
  id: string;
  brand_id: string;
  title: string;
  subtitle: string;
  image_url: string | null;
  r2_key: string | null;
  link_url: string | null;
  cta: string;
  starts_at: number | null;
  ends_at: number | null;
  sort_order: number;
  active: number;
  created_at: number;
};

export type ActivityRow = {
  id: string;
  type: string;
  member_id: string;
  brand_id: string;
  outlet_id: string | null;
  session_id: string | null;
  claim_id: string | null;
  stamps_delta: number;
  stamps_after: number;
  note: string;
  reverses_id: string | null;
  voided: number;
  created_at: number;
  member_name: string;
  wa: string;
  brand_name: string;
  short_name: string;
  outlet_name: string | null;
  reward_text: string;
};

export type FlagRow = {
  id: string;
  outlet_id: string | null;
  session_id: string | null;
  member_id: string | null;
  reason: string;
  detail: string;
  created_at: number;
  outlet_name: string | null;
  member_name: string | null;
};
