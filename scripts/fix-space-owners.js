import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mhuqgvhgbfovjuhacjxw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXFndmhnYmZvdmp1aGFjanh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MjY2OTUsImV4cCI6MjA4MzIwMjY5NX0.siSpeFR-vK4XuQz0AC6CBiojuSgj3JZ5vlYDXRUPsrU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixExistingSpaces() {
  console.log('Starting to fix existing spaces...');
  // Get all spaces
  const { data: spaces, error } = await supabase.from('spaces').select('id, owner_id');
  if (error) {
    console.error('Error fetching spaces:', error);
    return;
  }

  console.log(`Found ${spaces.length} spaces`);

  for (const space of spaces) {
    // Check if owner is already in space_members
    const { data: existing } = await supabase
      .from('space_members')
      .select('id')
      .eq('space_id', space.id)
      .eq('user_id', space.owner_id)
      .single();

    if (!existing) {
      // Add owner to space_members
      const { error: insertError } = await supabase.from('space_members').insert({
        space_id: space.id,
        user_id: space.owner_id,
        role: 'owner',
        status: 'accepted'
      });
      if (insertError) {
        console.error(`Error adding owner to space ${space.id}:`, insertError);
      } else {
        console.log(`Added owner to space ${space.id}`);
      }
    } else {
      console.log(`Owner already in space ${space.id}`);
    }
  }
  console.log('Done fixing spaces');
}

fixExistingSpaces().catch(console.error);