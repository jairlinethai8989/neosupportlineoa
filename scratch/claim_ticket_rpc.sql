-- CREATE OR REPLACE FUNCTION claim_ticket_secure
CREATE OR REPLACE FUNCTION claim_ticket_secure(p_ticket_id UUID, p_agent_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_role TEXT;
  v_customer_id UUID;
  v_conversation_id UUID;
  v_updated_ticket RECORD;
  v_result JSONB;
BEGIN
  -- 1. Verify agent role
  SELECT role INTO v_role FROM profiles WHERE id = p_agent_id;
  IF v_role IS NULL OR NOT (v_role = 'Agent' OR v_role = 'Administrator') THEN
    RAISE EXCEPTION 'Unauthorized: Agent or Administrator role required';
  END IF;

  -- 2. Update the ticket
  UPDATE tickets
  SET 
    assigned_agent_id = p_agent_id,
    status = 'In Progress',
    assigned_at = NOW(),
    updated_at = NOW()
  WHERE id = p_ticket_id
  RETURNING customer_id INTO v_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  -- 3. Select the updated ticket fields we need
  SELECT * FROM tickets WHERE id = p_ticket_id INTO v_updated_ticket;

  -- 4. Check conversation linkage
  IF v_customer_id IS NOT NULL THEN
    -- Check if there is an active conversation already linked to this ticket
    SELECT id INTO v_conversation_id 
    FROM conversations 
    WHERE current_ticket_id = p_ticket_id AND status = 'active'
    LIMIT 1;

    -- If not, find any active conversation for this customer and link it
    IF v_conversation_id IS NULL THEN
      SELECT id INTO v_conversation_id
      FROM conversations
      WHERE customer_id = v_customer_id AND status = 'active'
      ORDER BY last_message_at DESC
      LIMIT 1;

      IF v_conversation_id IS NOT NULL THEN
        UPDATE conversations
        SET current_ticket_id = p_ticket_id, last_message_at = NOW()
        WHERE id = v_conversation_id;
      ELSE
        -- Create a new active conversation if none exists
        INSERT INTO conversations (customer_id, current_ticket_id, status, last_message_at)
        VALUES (v_customer_id, p_ticket_id, 'active', NOW())
        RETURNING id INTO v_conversation_id;
      END IF;
    END IF;
  END IF;

  -- 5. Insert log
  INSERT INTO ticket_logs (ticket_id, action_type, to_status, performer_id, note)
  VALUES (p_ticket_id, 'claim', 'In Progress', p_agent_id, 'Agent claimed the ticket securely via RPC');

  -- 6. Build and return result
  v_result := jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', v_updated_ticket.id,
      'ticket_no', v_updated_ticket.ticket_no,
      'customer_id', v_updated_ticket.customer_id,
      'subject', v_updated_ticket.subject,
      'description', v_updated_ticket.description,
      'status', v_updated_ticket.status,
      'assigned_agent_id', v_updated_ticket.assigned_agent_id,
      'module', v_updated_ticket.module,
      'issue_type', v_updated_ticket.issue_type,
      'assigned_at', v_updated_ticket.assigned_at,
      'updated_at', v_updated_ticket.updated_at
    ),
    'conversationId', v_conversation_id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
