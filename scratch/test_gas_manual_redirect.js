const url = 'https://script.google.com/macros/s/AKfycbyTmiMFMQS0Bia6P4DDjiEB4pnmA1GXmyKBmhxRSWhSTjG8pAhbmH9mIuCeWvvGz03S/exec';

async function testManualRedirect() {
  try {
    console.log('Sending manual redirect POST to:', url);
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
      }),
      redirect: 'manual'
    });

    console.log('Initial Response Status:', res.status);
    console.log('Initial Response Headers:');
    res.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    const redirectUrl = res.headers.get('location');
    console.log('Redirect Location:', redirectUrl);

    if (redirectUrl) {
      console.log('Following redirect with POST to:', redirectUrl);
      const redirectRes = await fetch(redirectUrl, {
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

      console.log('Redirect Response Status:', redirectRes.status);
      const body = await redirectRes.text();
      console.log('Redirect Response Body:', body);
    }
  } catch (error) {
    console.error('Error during fetch:', error);
  }
}

testManualRedirect();
