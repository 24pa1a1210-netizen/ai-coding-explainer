const apiUrl = 'http://localhost:3000/api/ask';

fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Explain bubble sort' })
})
    .then(res => res.json().then(data => console.log('Status', res.status, 'Data:', data)))
    .catch(err => console.error('Fetch error:', err));
