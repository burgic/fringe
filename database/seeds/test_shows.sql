-- Test shows data for Edinburgh Fringe Show Tracker
-- Your curated test shows

INSERT OR IGNORE INTO shows (title, url, slug, venue, genre, price_range, rating, review_category, review_notes) VALUES 
(
  'David O''Doherty: Highway To The David Zone', 
  'https://www.edfringe.com/tickets/whats-on/david-o-doherty-highway-to-the-david-zone', 
  'david-o-doherty-highway-to-the-david-zone', 
  'Assembly George Square Studios', 
  'Comedy', 
  '£12-16', 
  '15+',
  'Great',
  'Well-established comedian with unique style and keyboard comedy'
),
(
  'Helen Bauer: Bless Her', 
  'https://www.edfringe.com/tickets/whats-on/helen-bauer-bless-her', 
  'helen-bauer-bless-her', 
  'Monkey Barrel Comedy', 
  'Comedy', 
  '£8-12', 
  '15+',
  'Good',
  'Rising star with sharp observational comedy'
),
(
  'Tony Law: Law and DisorganizeD', 
  'https://www.edfringe.com/tickets/whats-on/tony-law-law-and-disorganizeder', 
  'tony-law-law-and-disorganizeder', 
  'The Stand Comedy Club', 
  'Comedy', 
  '£10-14', 
  '18+',
  'Wild Cards',
  'Experimental surreal comedy - unpredictable and unique'
);