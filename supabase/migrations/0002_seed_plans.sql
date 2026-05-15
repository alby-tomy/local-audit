INSERT INTO plans (name, display_name, stripe_price_id, monthly_credits, max_users, features, price_usd)
VALUES
  ('starter', 'Starter', 'price_starter_placeholder', 50, 1, '{"api": false, "whitelabel": false}', 2900),
  ('pro', 'Pro', 'price_pro_placeholder', 200, 3, '{"api": true, "whitelabel": false}', 7900),
  ('agency', 'Agency', 'price_agency_placeholder', 99999, 5, '{"api": true, "whitelabel": true}', 19900)
ON CONFLICT (stripe_price_id) DO NOTHING;
