// Story radio lines (docs/product-logic.md 5.2, 9.1). Keys belong to the engine (developer A);
// the content team rewrites the English text on the right. Keep each line under ~70 characters.
const en: Record<string, string> = {
  'story.training.touchdown': 'TULPAR-1 is down. Suit check green. Walk to the marked site (WASD).',
  'story.training.brief': 'Welcome to Jezero. Bring two samples home and listen to the ground.',
  'story.training.seismo': 'Deploy the seismometer: press E at least 30 m from the lander.',
  'story.training.flare': 'Solar particle event inbound. Arrival in 30 seconds. Get inside.',
  'story.training.window': 'Launch window closes in 30 seconds. Everyone inside.',
  'story.signal.touchdown': 'TULPAR-1 is down. Systems green. Seismometer online.',
  'story.signal.brief': 'Repeating quakes from one spot near you. We call it RED SIGNAL. Find it.',
  'story.signal.seismo': 'Deploy the seismometer kits in a wide triangle around the site.',
  'story.signal.act2': 'The signal is real. Pin it down and bring us a sample of the source.',
  'story.signal.act3': 'Sunset. Power drops from here. Watch your oxygen.',
  'story.signal.located': 'Zone confirmed. The source is inside the red circle. Go find it.',
  'story.signal.retrieved': 'Signal sample aboard. Science team is ecstatic. Now come home.',
  'reveal.jezero': 'Fresh cracks in the old delta sediments: the delta front is still settling.',
  'reveal.elysium':
    'A fresh fault scarp and crushed basalt: the fault is alive, like Cerberus Fossae.',
  'reveal.arcadia': 'Ice in cracks under a fresh crater: impact-exposed ice is creaking.',
  'reveal.partial': 'You pinned the source down but brought no sample. The mystery stays open.',
  'reveal.note': 'In-game hypothesis inspired by real InSight findings.',
  'story.signal.window': 'Launch window closes in 60 seconds. Get the crew aboard.',
};
export default en;
