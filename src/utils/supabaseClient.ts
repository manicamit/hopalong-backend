import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const supabseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;


let supabaseClientInstace: ReturnType<typeof createBrowserClient> | null = null;

export const getSupabaseClientInstance = () => {
    if (!supabaseClientInstace) {
        return supabaseClientInstace = createBrowserClient(supabseUrl, supabaseKey);
    } else {
        return supabaseClientInstace;
    }
};


let supabaseServerInstace: ReturnType<typeof createClient> | null = null;

export const getSupabaseServerInstance = () => {
    if (!supabaseServerInstace) {
        return supabaseServerInstace = createClient(supabseUrl, supabaseKey);
    } else {
        return supabaseServerInstace;
    }
};

/*

import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

*/