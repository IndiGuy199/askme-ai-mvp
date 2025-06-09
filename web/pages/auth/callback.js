import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    firstName: '',
    age: '',
    city: '',
    country: '',
    maritalStatus: ''
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function checkProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Fetch user profile from your users table
        const { data: userProfile } = await supabase
          .from('users')
          .select('first_name')
          .eq('email', session.user.email)
          .single();
        if (userProfile && userProfile.first_name) {
          // Profile exists, redirect to dashboard
          router.replace('/dashboard');
        } else {
          // No profile, show the extra info form
          setUser(session.user);
          setSessionChecked(true);
        }
      } else {
        setSessionChecked(true);
      }
    }
    checkProfile();
  }, [router]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = localStorage.getItem('pendingEmail');
    if (!email) {
      setMessage('No email found. Please login again.');
      return;
    }
    const { error } = await supabase.from('users').upsert({
      email,
      first_name: form.firstName,
      age: form.age,
      city: form.city,
      country: form.country,
      marital_status: form.maritalStatus,
    });
    if (error) {
      setMessage(error.message);
    } else {
      localStorage.removeItem('pendingEmail');
      router.replace('/dashboard');
    }
  };

  if (!sessionChecked) return <div>Signing you in...</div>;
  if (!user) return <div>Could not authenticate. Please try logging in again.</div>;

  return (
    <div>
      <h1>Complete Your Signup</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="firstName"
          placeholder="First Name"
          value={form.firstName}
          onChange={handleChange}
          required
        />
        <input
          type="number"
          name="age"
          placeholder="Age (optional)"
          value={form.age}
          onChange={handleChange}
        />
        <input
          type="text"
          name="city"
          placeholder="City of Residence (optional)"
          value={form.city}
          onChange={handleChange}
        />
        <input
          type="text"
          name="country"
          placeholder="Country of Residence (optional)"
          value={form.country}
          onChange={handleChange}
        />
        <input
          type="text"
          name="maritalStatus"
          placeholder="Marital Status (optional)"
          value={form.maritalStatus}
          onChange={handleChange}
        />
        <button type="submit">Complete Signup</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}