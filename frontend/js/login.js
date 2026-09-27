document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');
  const errBox = document.getElementById('error');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    errBox.textContent = 'Enter username and password';
    errBox.classList.add('visible');
    return;
  }

  btn.disabled = true;
  btnText.textContent = 'Signing in...';
  btnSpinner.style.display = 'inline-block';
  errBox.textContent = '';
  errBox.classList.remove('visible');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message);
    sessionStorage.setItem('token', body.data.token);
    location.href = 'dashboard.html';
  } catch (ex) {
    errBox.textContent = ex.message;
    errBox.classList.add('visible');
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Sign In';
    btnSpinner.style.display = 'none';
  }
});

// If already logged in, redirect to dashboard
if (sessionStorage.getItem('token')) {
  location.href = 'dashboard.html';
}
