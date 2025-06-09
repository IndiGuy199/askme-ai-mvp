import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import Layout from '../components/Layout';

export default function Login() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback'
      }
    });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Check your email for the magic link!');
      localStorage.setItem('pendingEmail', email);
    }
  };

  return (
    <Layout title="Login">
      <div>
        <h1>Sign Up / Login</h1>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <button type="submit">Send Magic Link</button>
        </form>
        {message && <p>{message}</p>}
      </div>
    </Layout>
  );
}