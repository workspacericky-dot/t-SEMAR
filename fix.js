const fs = require('fs');
const path = require('path');

function replaceAdminFiles() {
    const files = [
        'src/lib/actions/user-actions.ts',
        'src/lib/actions/period-actions.ts',
        'src/lib/actions/audit-server-actions.ts',
        'src/lib/actions/assignment-actions.ts'
    ];

    for (const relativePath of files) {
        const file = path.resolve(__dirname, relativePath);
        let content = fs.readFileSync(file, 'utf8');

        // First, temporarily replace `supabaseAdmin` with `GET_SUPABASE_ADMIN()`
        // But only if it's an identifier
        content = content.replace(/(?<![\w\/"'-])supabaseAdmin(?![\w\/"'-])/g, 'getSupabaseAdmin()');

        // Now fix the definition which changed from `const supabaseAdmin = createClient(...)`
        // to `const getSupabaseAdmin() = createClient(...)`
        const regex = /const getSupabaseAdmin\(\)\s*=\s*createClient\([\s\S]*?\n\);/;

        const replacement = `const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);`;

        content = content.replace(regex, replacement);
        fs.writeFileSync(file, content);
        console.log('Fixed', file);
    }
}

function replaceAuditActions() {
    const file = path.resolve(__dirname, 'src/lib/actions/audit-actions.ts');
    let content = fs.readFileSync(file, 'utf8');

    // we must not replace @/lib/supabase/client
    // we use negative lookbehind/lookahead
    content = content.replace(/(?<![\w\/"'-])supabase(?![\w\/"'-])/g, 'getSupabase()');

    // fix the definition
    const regex = /const getSupabase\(\)\s*=\s*createClient\(\);/;
    content = content.replace(regex, 'const getSupabase = () => createClient();');

    fs.writeFileSync(file, content);
    console.log('Fixed', file);
}

replaceAdminFiles();
replaceAuditActions();
