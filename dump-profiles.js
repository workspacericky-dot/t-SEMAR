const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

async function run() {
    const { data: users, error } = await supabase.from('profiles').select('*');
    if (error) {
        console.error(error);
        return;
    }

    fs.writeFileSync('profiles.json', JSON.stringify(users, null, 2));
    console.log('Saved', users.length, 'profiles');
}

run().catch(console.error);
