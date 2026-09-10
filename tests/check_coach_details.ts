import 'dotenv/config';
import { db } from '../server/supabaseDb.ts';

async function check() {
  const coaches = await db.getAllCoaches();
  console.log("TOTAL COACHES:", coaches.length);
  for (const c of coaches) {
    console.log(`ID: ${c.id}, Name: ${c.displayName}, Email: ${c.email}, Status: ${c.status}`);
  }
}

check().catch(console.error);
