-- 1. Policies for 'tickets' table
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert for tickets" ON public.tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for tickets" ON public.tickets FOR UPDATE USING (true);
CREATE POLICY "Allow public select for tickets" ON public.tickets FOR SELECT USING (true);

-- 2. Policies for 'messages' table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert for messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select for messages" ON public.messages FOR SELECT USING (true);

-- 3. Policies for 'ticket_logs' table
ALTER TABLE public.ticket_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert for ticket_logs" ON public.ticket_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select for ticket_logs" ON public.ticket_logs FOR SELECT USING (true);

-- 4. Policies for 'customers' table 
-- (to ensure ProfileRegistrationModal works properly without errors)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert for customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for customers" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Allow public select for customers" ON public.customers FOR SELECT USING (true);
