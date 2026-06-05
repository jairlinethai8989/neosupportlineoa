-- Create RPC function to get conversation ID by ticket ID
-- Reduces API waterfall from 5 sequential queries down to a single database execution

CREATE OR REPLACE FUNCTION get_conversation_id_by_ticket_id(p_ticket_id UUID)
RETURNS UUID AS $$
DECLARE
  v_conv_id UUID;
  v_customer_id UUID;
BEGIN
  -- 1. Try to find conversation by current_ticket_id
  SELECT id INTO v_conv_id
  FROM conversations
  WHERE current_ticket_id = p_ticket_id
  ORDER BY last_message_at DESC NULLS LAST
  LIMIT 1;
  
  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- 2. Try to find conversation_id from messages
  SELECT conversation_id INTO v_conv_id
  FROM messages
  WHERE ticket_id = p_ticket_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- 3. Find customer_id from tickets
  SELECT customer_id INTO v_customer_id
  FROM tickets
  WHERE id = p_ticket_id;

  IF v_customer_id IS NOT NULL THEN
    -- Try to find active conversation first
    SELECT id INTO v_conv_id
    FROM conversations
    WHERE customer_id = v_customer_id AND status = 'active'
    ORDER BY last_message_at DESC NULLS LAST
    LIMIT 1;

    IF v_conv_id IS NOT NULL THEN
      RETURN v_conv_id;
    END IF;

    -- Try to find any conversation for this customer
    SELECT id INTO v_conv_id
    FROM conversations
    WHERE customer_id = v_customer_id
    ORDER BY last_message_at DESC NULLS LAST
    LIMIT 1;
    
    RETURN v_conv_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
