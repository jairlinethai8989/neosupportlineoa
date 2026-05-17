const url = 'https://script.google.com/macros/s/AKfycbyTmiMFMQS0Bia6P4DDjiEB4pnmA1GXmyKBmhxRSWhSTjG8pAhbmH9mIuCeWvvGz03S/exec';

async function testRequest() {
  try {
    console.log('Sending POST to:', url);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rows: [
          {
            Status: 'New',
            Date: '17/05/2026',
            Hospital: 'Test Hospital',
            Customer: 'Test Customer',
            Subject: 'Test Subject',
            'Additional Details': 'Details',
            Resolution: '',
            Assignee: 'Agent',
            Source: 'Line',
            Module: 'Test',
            Type: 'Bug',
            'Created Time': '21:00',
            'Resolved Time': '-',
            'Time Used': '-'
          }
        ]
      })
    });

    console.log('Response Status:', res.status);
    console.log('Response StatusText:', res.statusText);
    console.log('Response Headers:');
    res.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    const body = await res.text();
    console.log('Response Body Snippet:', body.substring(0, 1000));
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testRequest();
