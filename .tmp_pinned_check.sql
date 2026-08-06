SELECT id, pinned_details FROM public.profiles WHERE pinned_details IS NOT NULL AND pinned_details != '[]'::jsonb;
