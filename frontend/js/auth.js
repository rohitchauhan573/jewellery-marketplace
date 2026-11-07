const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const msg = document.getElementById('msg');
const submitBtn = document.getElementById('submit');

function setMsg(text, ok) {
  msg.textContent = text || '';
  msg.className = 'notice ' + (ok ? 'ok' : 'error');
  msg.hidden = !text;
}

async function doLogin(email, password) {
  const data = await apiFetch('/auth/login', { method: 'POST', body: { email, password } });
  Auth.save(data.token, data.user);
  return data.user;
}

function goAfterLogin(user) {
  location.href = user.role === 'shop_owner' ? 'dashboard.html' : 'index.html';
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('');
    submitBtn.disabled = true;
    try {
      const user = await doLogin(
        document.getElementById('email').value.trim(),
        document.getElementById('password').value
      );
      goAfterLogin(user);
    } catch (err) {
      setMsg(err.message === 'Failed to fetch'
        ? 'Could not reach the server. Is the backend running?'
        : err.message, false);
      submitBtn.disabled = false;
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('');
    submitBtn.disabled = true;

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    try {
      await apiFetch('/auth/register', { method: 'POST', body: { name, email, password, role } });
      const user = await doLogin(email, password);
      goAfterLogin(user);
    } catch (err) {
      setMsg(err.message === 'Failed to fetch'
        ? 'Could not reach the server. Is the backend running?'
        : err.message, false);
      submitBtn.disabled = false;
    }
  });
}