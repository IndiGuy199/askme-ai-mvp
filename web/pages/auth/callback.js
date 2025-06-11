import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { determineOptimalCoach, getCoachAssignmentReason } from '../../utils/coachMatcher';

export default function AuthCallback() {
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [allGoals, setAllGoals] = useState([]);
  const [allChallenges, setAllChallenges] = useState([]);
  const [form, setForm] = useState({
    firstName: '',
    age: '',
    sex: '',
    ethnicity: '',
    city: '',
    country: '',
    maritalStatus: '',
    selectedGoals: [],
    selectedChallenges: []
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const countries = [
    'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 
    'France', 'Italy', 'Spain', 'Netherlands', 'Sweden', 'Norway', 'Denmark',
    'Finland', 'Switzerland', 'Austria', 'Belgium', 'Portugal', 'Other'
  ];

  useEffect(() => {
    async function initialize() {
      try {
        console.log('🚀 Initializing callback page...');
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          setMessage('Authentication error. Please try logging in again.');
          setSessionChecked(true);
          setDataLoading(false);
          return;
        }

        if (session) {
          console.log('✅ Session found for user:', session.user.email);
          
          // Check if user profile exists and is complete
          const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('first_name, profile_completed, coach_profile_id, coach_profiles(*)')
            .eq('email', session.user.email)
            .single();
          
          if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('❌ Error checking user profile:', profileError);
          }
          
          if (userProfile && userProfile.profile_completed) {
            console.log('✅ User profile already complete, redirecting to dashboard');
            router.replace('/dashboard');
            return;
          }

          console.log('📝 User profile incomplete, loading signup options...');
          // Load all available goals and challenges
          await loadAllOptions();

          setUser(session.user);
          setSessionChecked(true);
        } else {
          console.log('❌ No session found');
          setSessionChecked(true);
        }
      } catch (error) {
        console.error('💥 Fatal error in initialize:', error);
        setMessage('An unexpected error occurred. Please refresh the page.');
      } finally {
        setDataLoading(false);
      }
    }
    initialize();
  }, [router]);

  const loadAllOptions = async () => {
    try {
      console.log('📊 Loading wellness goals and challenges...');
      setDataLoading(true);

      // Fetch all unique wellness goals from all coaches
      const { data: goalsData, error: goalsError } = await supabase
        .from('coach_wellness_goals')
        .select(`
          id,
          goal_id,
          label,
          description,
          display_order,
          coach_profiles!inner(code, label)
        `)
        .eq('is_active', true)
        .order('display_order');

      if (goalsError) {
        console.error('❌ Error fetching goals:', goalsError);
        throw goalsError;
      }

      console.log(`✅ Loaded ${goalsData?.length || 0} wellness goals`);

      // Fetch all unique challenges from all coaches
      const { data: challengesData, error: challengesError } = await supabase
        .from('coach_challenges')
        .select(`
          id,
          challenge_id,
          label,
          description,
          display_order,
          coach_profiles!inner(code, label)
        `)
        .eq('is_active', true)
        .order('display_order');

      if (challengesError) {
        console.error('❌ Error fetching challenges:', challengesError);
        throw challengesError;
      }

      console.log(`✅ Loaded ${challengesData?.length || 0} challenges`);

      // Remove duplicates based on goal_id and challenge_id, keep the first occurrence
      const uniqueGoals = [];
      const seenGoalIds = new Set();
      
      goalsData?.forEach(goal => {
        if (!seenGoalIds.has(goal.goal_id)) {
          uniqueGoals.push(goal);
          seenGoalIds.add(goal.goal_id);
        }
      });

      const uniqueChallenges = [];
      const seenChallengeIds = new Set();
      
      challengesData?.forEach(challenge => {
        if (!seenChallengeIds.has(challenge.challenge_id)) {
          uniqueChallenges.push(challenge);
          seenChallengeIds.add(challenge.challenge_id);
        }
      });

      console.log(`📋 Processed ${uniqueGoals.length} unique goals and ${uniqueChallenges.length} unique challenges`);
      
      setAllGoals(uniqueGoals || []);
      setAllChallenges(uniqueChallenges || []);

    } catch (error) {
      console.error('💥 Error loading options:', error);
      setMessage('Error loading signup options. Please refresh the page.');
    } finally {
      setDataLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const toggleSelection = (type, itemId) => {
    setForm(prev => {
      const currentArray = prev[type];
      const isSelected = currentArray.includes(itemId);
      
      return {
        ...prev,
        [type]: isSelected 
          ? currentArray.filter(item => item !== itemId)
          : [...currentArray, itemId]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    console.log('🚀 Starting signup submission...');
    
    const email = user?.email;
    if (!email) {
      console.error('❌ No email found in user object');
      setMessage('No email found. Please login again.');
      setLoading(false);
      return;
    }

    try {
      console.log('📝 Form data:', form);
      console.log('📧 User email:', email);
      
      // Get the goal_ids and challenge_ids for algorithm
      const selectedGoalIds = form.selectedGoals.map(goalId => {
        const goal = allGoals.find(g => g.id === goalId);
        return goal ? goal.goal_id : goalId;
      });

      const selectedChallengeIds = form.selectedChallenges.map(challengeId => {
        const challenge = allChallenges.find(c => c.id === challengeId);
        return challenge ? challenge.challenge_id : challengeId;
      });

      console.log('🎯 Selected goal IDs:', selectedGoalIds);
      console.log('🎯 Selected challenge IDs:', selectedChallengeIds);

      // Parse age as number (convert empty string to null)
      const userAge = form.age ? parseInt(form.age, 10) : null;
      console.log('👤 User age:', userAge);

      // Determine optimal coach based on age, goals, and challenges
      const optimalCoachCode = determineOptimalCoach(selectedGoalIds, selectedChallengeIds, userAge);
      console.log('🎯 Optimal coach code:', optimalCoachCode);
      
      // Get the coach profile
      const { data: assignedCoach, error: coachError } = await supabase
        .from('coach_profiles')
        .select('*')
        .eq('code', optimalCoachCode)
        .single();

      if (coachError || !assignedCoach) {
        console.error('❌ Coach fetch error:', coachError);
        console.log('🔄 Attempting fallback to wellness coach...');
        
        // Fallback to wellness coach
        const { data: fallbackCoach, error: fallbackError } = await supabase
          .from('coach_profiles')
          .select('*')
          .eq('code', 'wellness')
          .single();
        
        if (fallbackError || !fallbackCoach) {
          console.error('💥 Fallback coach fetch error:', fallbackError);
          throw new Error('Could not find any coach profile. Please contact support.');
        }
        
        console.log('✅ Using fallback wellness coach');
        assignedCoach = fallbackCoach;
      }

      console.log('👨‍⚕️ Assigned coach:', assignedCoach.label);

      // Create the user record
      const userData = {
        email,
        first_name: form.firstName,
        age: userAge,
        sex: form.sex || null,
        ethnicity: form.ethnicity || null,
        city: form.city || null,
        country: form.country || null,
        marital_status: form.maritalStatus || null,
        coach_profile_id: assignedCoach.id,
        profile_completed: true,
        tokens: 20, // Welcome tokens
        last_login: new Date().toISOString()
      };

      console.log('💾 Saving user data:', userData);

      // Create or update user profile with assigned coach
      const { data: userResult, error: userError } = await supabase
        .from('users')
        .upsert(userData)
        .select('id')
        .single();

      if (userError) {
        console.error('❌ User upsert error:', userError);
        console.error('❌ User upsert error details:', {
          message: userError.message,
          details: userError.details,
          hint: userError.hint,
          code: userError.code
        });
        throw userError;
      }

      console.log('✅ User created/updated successfully, ID:', userResult.id);
      const userId = userResult.id;

      // Save selected wellness goals (using the database IDs)
      if (form.selectedGoals.length > 0) {
        console.log('📊 Saving selected goals...');
        const goalInserts = form.selectedGoals.map(goalId => ({
          user_id: userId,
          coach_wellness_goal_id: goalId
        }));

        const { error: goalsError } = await supabase
          .from('user_wellness_goals')
          .insert(goalInserts);

        if (goalsError) {
          console.error('❌ Goals insert error:', goalsError);
          // Don't throw error for goals/challenges as they're optional
        } else {
          console.log('✅ Goals saved successfully');
        }
      }

      // Save selected challenges (using the database IDs)
      if (form.selectedChallenges.length > 0) {
        console.log('📊 Saving selected challenges...');
        const challengeInserts = form.selectedChallenges.map(challengeId => ({
          user_id: userId,
          coach_challenge_id: challengeId
        }));

        const { error: challengesError } = await supabase
          .from('user_challenges')
          .insert(challengeInserts);

        if (challengesError) {
          console.error('❌ Challenges insert error:', challengesError);
          // Don't throw error for goals/challenges as they're optional
        } else {
          console.log('✅ Challenges saved successfully');
        }
      }

      // Log the coach assignment for debugging
      const assignmentReason = getCoachAssignmentReason(optimalCoachCode, selectedGoalIds, selectedChallengeIds, userAge);
      console.log(`🎯 Coach Assignment: ${assignedCoach.label} - ${assignmentReason}`);

      console.log('🎉 Signup completed successfully, redirecting to dashboard...');
      router.replace('/dashboard');
      
    } catch (error) {
      console.error('💥 Submit error:', error);
      console.error('💥 Submit error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      setMessage(error.message || 'An error occurred during signup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!sessionChecked || dataLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <h5 className="text-muted">
            {!sessionChecked ? 'Signing you in...' : 'Loading signup options...'}
          </h5>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <div className="mb-4">
            <i className="bi bi-exclamation-triangle text-danger" style={{ fontSize: '4rem' }}></i>
          </div>
          <h3 className="text-danger mb-3">Authentication Error</h3>
          <p className="text-muted mb-4">Could not authenticate. Please try logging in again.</p>
          <button className="btn btn-primary btn-lg" onClick={() => router.push('/login')}>
            <i className="bi bi-arrow-left me-2"></i>Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100" style={{ backgroundColor: '#f8f9fa' }}>
      {/* Navigation */}
      <nav className="navbar navbar-expand navbar-light bg-white border-bottom mb-4">
        <div className="container">
          <div className="navbar-nav me-auto">
            <span className="nav-link fw-bold text-primary">Setup Profile</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-7 col-xl-6">
            <div className="card border-0 shadow-lg" style={{ borderRadius: '1rem' }}>
              <div className="card-body p-4">
                {/* Compact Header */}
                <div className="text-center mb-4">
                  <div className="mb-2">
                    <i className="bi bi-person-plus-fill text-primary" style={{ fontSize: '2.5rem' }}></i>
                  </div>
                  <h1 className="h3 fw-bold text-dark mb-1">Complete Your Signup</h1>
                  <p className="text-muted small mb-0">
                    We'll match you with the perfect coach based on your profile
                  </p>
                </div>

                <form onSubmit={handleSubmit}>
                  {/* Compact Personal Information */}
                  <div className="row mb-3">
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-semibold text-dark small">
                        First Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        className="form-control"
                        placeholder="Enter your first name"
                        value={form.firstName}
                        onChange={handleChange}
                        required
                        style={{ borderRadius: '0.5rem' }}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-semibold text-dark small">
                        Age <span className="text-muted">(optional)</span>
                      </label>
                      <input
                        type="number"
                        name="age"
                        className="form-control"
                        placeholder="Your age"
                        value={form.age}
                        onChange={handleChange}
                        min="13"
                        max="120"
                        style={{ borderRadius: '0.5rem' }}
                      />
                    </div>
                  </div>

                  {/* Sex and Ethnicity Row */}
                  <div className="row mb-3">
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-semibold text-dark small">
                        Sex <span className="text-muted">(optional)</span>
                      </label>
                      <select
                        name="sex"
                        className="form-select"
                        value={form.sex}
                        onChange={handleChange}
                        style={{ borderRadius: '0.5rem' }}
                      >
                        <option value="">Select sex</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="non-binary">Non-binary</option>
                        <option value="prefer-not-to-say">Prefer not to say</option>
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-semibold text-dark small">
                        Ethnicity <span className="text-muted">(optional)</span>
                      </label>
                      <select
                        name="ethnicity"
                        className="form-select"
                        value={form.ethnicity}
                        onChange={handleChange}
                        style={{ borderRadius: '0.5rem' }}
                      >
                        <option value="">Select ethnicity</option>
                        <option value="white">White</option>
                        <option value="black-african-american">Black or African American</option>
                        <option value="hispanic-latino">Hispanic or Latino</option>
                        <option value="asian">Asian</option>
                        <option value="native-american">Native American</option>
                        <option value="pacific-islander">Pacific Islander</option>
                        <option value="mixed-race">Mixed Race</option>
                        <option value="middle-eastern">Middle Eastern</option>
                        <option value="other">Other</option>
                        <option value="prefer-not-to-say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>

                  {/* Location Row */}
                  <div className="row mb-3">
                    <div className="col-md-7 mb-3">
                      <label className="form-label fw-semibold text-dark small">Country</label>
                      <select
                        name="country"
                        className="form-select"
                        value={form.country}
                        onChange={handleChange}
                        style={{ borderRadius: '0.5rem' }}
                      >
                        <option value="">Select your country</option>
                        {countries.map(country => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-5 mb-3">
                      <label className="form-label fw-semibold text-dark small">
                        City <span className="text-muted">(optional)</span>
                      </label>
                      <input
                        type="text"
                        name="city"
                        className="form-control"
                        placeholder="Enter your city"
                        value={form.city}
                        onChange={handleChange}
                        style={{ borderRadius: '0.5rem' }}
                      />
                    </div>
                  </div>

                  {/* Compact Wellness Goals Section */}
                  {allGoals.length > 0 && (
                    <div className="mb-3">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <label className="form-label fw-semibold text-dark small mb-0">
                          Primary wellness goals?
                        </label>
                        <div className="d-flex align-items-center">
                          <small className="text-muted me-2" style={{ fontSize: '0.75rem' }}>
                            <i className="bi bi-check-square me-1"></i>
                            Select multiple
                          </small>
                          {form.selectedGoals.length > 0 && (
                            <span className="badge bg-primary rounded-pill" style={{ fontSize: '0.7rem' }}>
                              {form.selectedGoals.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="row g-2">
                        {allGoals.map(goal => (
                          <div key={goal.id} className="col-6 col-lg-4">
                            <button
                              type="button"
                              className={`btn w-100 py-2 position-relative ${
                                form.selectedGoals.includes(goal.id) 
                                  ? 'btn-primary' 
                                  : 'btn-outline-secondary'
                              }`}
                              style={{ 
                                borderRadius: '0.5rem', 
                                fontWeight: '500',
                                fontSize: '0.8rem'
                              }}
                              onClick={() => toggleSelection('selectedGoals', goal.id)}
                              title={goal.description}
                            >
                              {/* Selection indicator */}
                              {form.selectedGoals.includes(goal.id) && (
                                <i className="bi bi-check-circle-fill position-absolute top-0 end-0 translate-middle text-white" 
                                   style={{ fontSize: '0.9rem' }}></i>
                              )}
                              {goal.label}
                            </button>
                          </div>
                        ))}
                      </div>
                      {form.selectedGoals.length > 0 && (
                        <div className="mt-2">
                          <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                            <i className="bi bi-lightbulb me-1"></i>
                            {form.selectedGoals.length} goal{form.selectedGoals.length > 1 ? 's' : ''} selected
                          </small>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Compact Challenges Section */}
                  {allChallenges.length > 0 && (
                    <div className="mb-4">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <label className="form-label fw-semibold text-dark small mb-0">
                          What challenges are you facing?
                        </label>
                        <div className="d-flex align-items-center">
                          <small className="text-muted me-2" style={{ fontSize: '0.75rem' }}>
                            <i className="bi bi-check-square me-1"></i>
                            Select all that apply
                          </small>
                          {form.selectedChallenges.length > 0 && (
                            <span className="badge bg-secondary rounded-pill" style={{ fontSize: '0.7rem' }}>
                              {form.selectedChallenges.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="row g-1">
                        {allChallenges.map(challenge => (
                          <div key={challenge.id} className="col-6 col-md-4">
                            <button
                              type="button"
                              className={`btn w-100 py-1 position-relative ${
                                form.selectedChallenges.includes(challenge.id) 
                                  ? 'btn-primary' 
                                  : 'btn-outline-secondary'
                              }`}
                              style={{ 
                                borderRadius: '0.4rem', 
                                fontWeight: '500', 
                                fontSize: '0.75rem',
                                minHeight: '2.2rem'
                              }}
                              onClick={() => toggleSelection('selectedChallenges', challenge.id)}
                              title={challenge.description}
                            >
                              {/* Selection indicator */}
                              {form.selectedChallenges.includes(challenge.id) && (
                                <i className="bi bi-check-circle-fill position-absolute top-0 end-0 translate-middle text-white" 
                                   style={{ fontSize: '0.8rem' }}></i>
                              )}
                              {challenge.label}
                            </button>
                          </div>
                        ))}
                      </div>
                      {form.selectedChallenges.length > 0 && (
                        <div className="mt-2">
                          <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                            <i className="bi bi-heart me-1"></i>
                            {form.selectedChallenges.length} challenge{form.selectedChallenges.length > 1 ? 's' : ''} selected
                          </small>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Compact Submit Button */}
                  <div className="d-grid">
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg py-2"
                      style={{
                        borderRadius: '0.5rem',
                        fontWeight: '600',
                        fontSize: '1rem'
                      }}
                      disabled={loading || !form.firstName}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Finding Your Coach...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-circle me-2"></i>
                          Complete Signup
                          {(form.selectedGoals.length > 0 || form.selectedChallenges.length > 0) && (
                            <small className="d-block mt-1" style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                              {form.selectedGoals.length} goals • {form.selectedChallenges.length} challenges
                            </small>
                          )}
                        </>
                      )}
                    </button>
                  </div>

                  {message && (
                    <div className="alert alert-danger mt-3" role="alert" style={{ borderRadius: '0.5rem' }}>
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      <small>{message}</small>
                    </div>
                  )}

                  {/* Compact No Data Warning */}
                  {allGoals.length === 0 && allChallenges.length === 0 && !dataLoading && (
                    <div className="alert alert-warning mt-3" role="alert" style={{ borderRadius: '0.5rem' }}>
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      <small>No goals or challenges found. Please check your database setup.</small>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}