import React, { useEffect, useState, useRef } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getApiUrl = () => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return `http://${window.location.hostname}:4000`;
  }
  return process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.114:4000';
};
const API = getApiUrl();
const langs = ['English', 'Hindi', 'Hinglish', 'Marathi'];

const CITIZEN_RIGHTS = [
  {
    title: '🚦 Traffic Challan & DigiLocker',
    fact: 'Under Section 139 of the Motor Vehicles Act & IT Act 2000, digital copies of your Driving License & RC in DigiLocker or mParivahan are 100% legally equivalent to original physical documents.',
    law: 'Motor Vehicles Act § 139 & IT Act § 4',
  },
  {
    title: '👮 Traffic Police Fine Authority',
    fact: 'Only a Sub-Inspector (SI) or higher rank traffic police officer can collect compound spot fines. A constable cannot confiscate your vehicle keys or tow your car while you are inside.',
    law: 'State Traffic Police Manual & MV Act',
  },
  {
    title: '⚖️ Zero FIR Registration',
    fact: 'If a crime occurs, you can register a "Zero FIR" at ANY police station in India, regardless of territorial jurisdiction. The station must accept the complaint and transfer it.',
    law: 'CrPC Section 154 / BNSS Section 173',
  },
  {
    title: '👩 Woman Arrest Protections',
    fact: 'A woman cannot be arrested after sunset (6:00 PM) and before sunrise (6:00 AM) except in exceptional circumstances with prior written permission from a Judicial Magistrate.',
    law: 'Section 46(4) CrPC / BNSS § 35',
  },
  {
    title: '🏷️ MRP & Cooling Charges',
    fact: 'No retailer, restaurant, airport shop, or multiplex can charge above Maximum Retail Price (MRP). Demanding extra money for refrigeration/cooling is an illegal unfair trade practice.',
    law: 'Legal Metrology Act & Consumer Protection Act',
  },
  {
    title: '🏠 Tenant Eviction Protections',
    fact: 'A landlord cannot forcefully evict a tenant, lock doors, or disconnect essential services (water, electricity) without following due process of legal notice.',
    law: 'Rent Control Act & Transfer of Property Act',
  },
  {
    title: '🎓 Withholding Original Certificates',
    fact: 'UGC and AICTE strictly prohibit colleges and universities from retaining original academic marksheets and degrees upon admission or departure.',
    law: 'UGC Notification on Document Verification',
  },
  {
    title: '💳 3-Day Zero Liability on Cyber Fraud',
    fact: 'If an unauthorized digital or UPI bank transaction occurs, reporting it to your bank and the 1930 Cyber Helpline within 3 days ensures 100% zero customer liability for the lost amount.',
    law: 'RBI Master Directions on Customer Liability',
  },
  {
    title: '🏦 Loan Recovery Agent Restrictions',
    fact: 'RBI Fair Practices Code strictly prohibits recovery agents from calling before 8:00 AM or after 7:00 PM, visiting workplaces without consent, or using abusive language.',
    law: 'RBI Fair Practices Code for Lenders',
  },
  {
    title: '🆓 Free Legal Aid (Article 39A)',
    fact: 'Under Article 39A of the Indian Constitution, all women, custody detainees, and citizens under income thresholds are entitled to free legal aid through NALSA & DLSA.',
    law: 'Legal Services Authorities Act 1987',
  },
];

const EXAMPLE_SCENARIOS = [
  {
    tag: '💼 Unpaid Salary',
    text: "My company hasn't paid my salary for three months and keeps saying next week.",
  },
  {
    tag: '🛍️ Damaged Online Product',
    text: 'I bought a phone online and received a damaged product. The seller refuses to replace it.',
  },
  {
    tag: '🔒 Digital Threat / Blackmail',
    text: 'Someone is threatening to leak my private photos unless I pay them money.',
  },
  {
    tag: '🎓 College Certificates',
    text: "My college has kept my original certificates and won't give them back.",
  },
  {
    tag: '💵 Friend Unpaid Loan',
    text: 'I lent my friend ₹50,000 and now he refuses to return it.',
  },
  {
    tag: '🏠 Rental Deposit',
    text: 'My landlord is refusing to return my security deposit of ₹30,000 after I vacated.',
  },
];

const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;

const Btn = ({ title, onPress, secondary, danger, disabled, style }) => (
  <TouchableOpacity
    disabled={disabled}
    onPress={onPress}
    style={[
      s.btn,
      secondary && s.secondary,
      danger && s.dangerBtn,
      disabled && { opacity: 0.5 },
      style,
    ]}
  >
    <Text style={[s.btnText, danger && { color: '#fff' }]}>{title}</Text>
  </TouchableOpacity>
);

export default function App() {
  const [screen, setScreen] = useState('welcome');
  const [authState, setAuthState] = useState(null); // 'guest' | 'phone' | null
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [lang, setLang] = useState('English');
  const [problem, setProblem] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [followUpAnswers, setFollowUpAnswers] = useState({});
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState([]);
  const [verifiedDocs, setVerifiedDocs] = useState({});
  const [tipIndex, setTipIndex] = useState(() =>
    Math.floor(Math.random() * CITIZEN_RIGHTS.length)
  );
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Check saved auth state
    AsyncStorage.getItem('kayda_auth_state').then((auth) => {
      if (auth) {
        setAuthState(auth);
        setScreen('home');
      } else {
        setScreen('welcome');
      }
    });

    AsyncStorage.getItem('kayda_cases_v2').then((x) => {
      if (x) {
        try {
          setCases(JSON.parse(x));
        } catch (e) {}
      }
    });
  }, []);

  const nextTip = () => {
    setTipIndex((prev) => (prev + 1) % CITIZEN_RIGHTS.length);
  };

  const saveCasesToStorage = async (updatedCases) => {
    setCases(updatedCases);
    await AsyncStorage.setItem('kayda_cases_v2', JSON.stringify(updatedCases));
  };

  const toggleDoc = (docName) => {
    setVerifiedDocs((prev) => ({
      ...prev,
      [docName]: !prev[docName],
    }));
  };

  const handleFollowUpChange = (qId, text) => {
    setFollowUpAnswers((prev) => ({
      ...prev,
      [qId]: text,
    }));
  };

  // -------------------------------------------------------------
  // AUTH / LOGIN HANDLERS
  // -------------------------------------------------------------
  const handleContinueAsGuest = async () => {
    setAuthState('guest');
    await AsyncStorage.setItem('kayda_auth_state', 'guest');
    setScreen('home');
  };

  const handleGoogleLogin = () => {
    Alert.alert(
      'Google Sign-In',
      'Google authentication interface is ready and will be connected in a later step. You can tap "Continue as Guest" to explore all features right away.',
      [
        { text: 'Stay on Login', style: 'cancel' },
        { text: 'Continue as Guest', onPress: handleContinueAsGuest },
      ]
    );
  };

  const handleSendOtp = () => {
    if (!phoneNumber || phoneNumber.trim().length < 10) {
      return Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
    }
    setScreen('phone_otp');
  };

  const handleVerifyOtp = async () => {
    setAuthState(`phone:${phoneNumber}`);
    await AsyncStorage.setItem('kayda_auth_state', `phone:${phoneNumber}`);
    setScreen('home');
  };

  const handleLogout = async () => {
    setAuthState(null);
    await AsyncStorage.removeItem('kayda_auth_state');
    setScreen('welcome');
  };

  // -------------------------------------------------------------
  // SPEECH RECOGNITION (Web Speech API with Fallback)
  // -------------------------------------------------------------
  const toggleSpeechRecognition = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        Alert.alert(
          'Voice Input',
          'Voice recognition is not supported in this browser. Please type your problem description.'
        );
        return;
      }

      if (isListening) {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        setIsListening(false);
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang =
          lang === 'Hindi'
            ? 'hi-IN'
            : lang === 'Marathi'
            ? 'mr-IN'
            : 'en-IN';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setProblem((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setIsListening(false);
        };

        recognition.onerror = (event) => {
          console.log('Speech recognition error', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error('Speech error', err);
        setIsListening(false);
      }
    } else {
      Alert.alert(
        'Voice Input',
        'Voice recognition is active in web browsers via Web Speech API. On mobile app, you can also use your keyboard voice typing dictation key.'
      );
    }
  };

  // -------------------------------------------------------------
  // ANALYZE INTAKE
  // -------------------------------------------------------------
  const analyze = async (currentProblem = problem, customAnswers = followUpAnswers) => {
    const textToAnalyze = currentProblem || problem;
    if (!textToAnalyze.trim()) {
      return Alert.alert('What happened?', 'Please describe your problem in your own words.');
    }

    setLoading(true);
    try {
      const formattedAnswers = Object.keys(customAnswers).map((qId) => ({
        questionId: qId,
        question: analysis?.followUpQuestions?.find((q) => q.id === qId)?.question || qId,
        value: customAnswers[qId],
      })).filter((a) => a.value && a.value.trim());

      const res = await fetch(`${API}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem: textToAnalyze,
          language: lang,
          location: {
            state: locationState.trim(),
            city: locationCity.trim(),
            country: 'India',
          },
          answers: formattedAnswers,
        }),
      });

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();

      setAnalysis(data.analysis);
      setScreen('case');
    } catch (e) {
      console.error(e);
      Alert.alert(
        'Backend Connection Issue',
        'Unable to reach Kayda Sathi server. Ensure the backend is running at ' + API
      );
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentCase = async () => {
    if (!analysis) return;
    const newCase = {
      id: Date.now(),
      title: analysis.legalAreas?.[0]?.name || 'Legal Intake Case',
      problem: problem,
      understanding: analysis.understanding,
      legalAreas: analysis.legalAreas || [],
      completeness: analysis.completeness?.label || 'Analyzed',
      date: new Date().toLocaleDateString('en-GB'),
      timestamp: new Date().toISOString(),
      analysis: analysis,
      verifiedDocs: verifiedDocs,
    };

    const updated = [newCase, ...cases.filter((c) => c.problem !== problem)];
    await saveCasesToStorage(updated);
    Alert.alert('Case Saved', 'This case has been saved locally under My Cases.');
  };

  const openSavedCase = (savedCase) => {
    setProblem(savedCase.problem);
    setAnalysis(savedCase.analysis);
    setVerifiedDocs(savedCase.verifiedDocs || {});
    setScreen('case');
  };

  // -------------------------------------------------------------
  // DRAFT GENERATOR
  // -------------------------------------------------------------
  const generateDraft = async () => {
    if (!analysis) return;
    setLoading(true);
    try {
      const docPayload = (analysis.documents || []).map((doc) => ({
        name: doc.name,
        verified: Boolean(verifiedDocs[doc.name]),
      }));

      const primaryAuthority = analysis.authorities?.[0];
      const primaryArea = analysis.legalAreas?.[0]?.name || 'Citizen Grievance';
      const statutoryRef = analysis.rightsAndFrameworks?.[0]?.framework || '';

      const res = await fetch(`${API}/api/complaint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: primaryAuthority?.name || '[Concerned Authority / Opposite Party]',
          recipientAddress: primaryAuthority?.purpose || '[Department / Office Address]',
          subject: `Formal Grievance / Notice regarding ${primaryArea}`,
          facts: analysis.understanding || problem,
          statutoryFramework: statutoryRef,
          requestedRemedy:
            'Please investigate the facts placed on record and initiate appropriate statutory redressal / resolution within 15 days.',
          documents: docPayload,
        }),
      });

      const d = await res.json();
      setDraft(d.draft);
      setScreen('draft');
    } catch (e) {
      Alert.alert('Error', 'Failed to generate draft from backend.');
    } finally {
      setLoading(false);
    }
  };

  const currentRight = CITIZEN_RIGHTS[tipIndex];
  const totalDocs = analysis?.documents?.length || 0;
  const verifiedCount = Object.values(verifiedDocs).filter(Boolean).length;
  const progressPercent = totalDocs > 0 ? Math.round((verifiedCount / totalDocs) * 100) : 0;

  // -------------------------------------------------------------
  // SCREEN: WELCOME / LOGIN SCREEN
  // -------------------------------------------------------------
  const renderWelcome = () => (
    <ScrollView contentContainerStyle={s.welcomeWrap}>
      {/* Brand Header */}
      <View style={s.welcomeHeader}>
        <Text style={s.welcomeBadge}>⚖️ TECKTONIX '26</Text>
        <Text style={s.brandTitle}>KAYDA SATHI</Text>
        <Text style={s.brandTagline}>"Justice, made simpler."</Text>
      </View>

      {/* Hero Illustration Card */}
      <View style={s.heroIllustrationBox}>
        <Image
          source={require('./assets/gavel_hero.jpg')}
          style={s.heroImage}
          resizeMode="cover"
        />
      </View>

      {/* Supporting Text */}
      <View style={s.welcomeTextCard}>
        <Text style={s.welcomeHeadline}>Legal problems can be confusing.</Text>
        <Text style={s.welcomeSubText}>
          Tell us what happened in your own words, and we'll help you figure out what to do next.
        </Text>
      </View>

      {/* Login Options Card */}
      <View style={s.authCard}>
        <Text style={s.getStartedLabel}>GET STARTED</Text>

        {/* Primary Option: Google */}
        <TouchableOpacity onPress={handleGoogleLogin} style={s.googleBtn}>
          <Text style={s.googleIcon}>🔴</Text>
          <Text style={s.googleBtnText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Secondary Option: Phone Number */}
        <TouchableOpacity
          onPress={() => setScreen('phone_input')}
          style={s.phoneBtn}
        >
          <Text style={s.phoneIcon}>📱</Text>
          <Text style={s.phoneBtnText}>Continue with Phone Number</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>OR</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Guest Mode */}
        <TouchableOpacity
          onPress={handleContinueAsGuest}
          style={s.guestBtn}
        >
          <Text style={s.guestBtnText}>Continue as Guest →</Text>
        </TouchableOpacity>

        <Text style={s.termsText}>
          By continuing, you agree to Kayda Sathi's terms of civic information & legal aid navigation.
        </Text>
      </View>
    </ScrollView>
  );

  // -------------------------------------------------------------
  // SCREEN: PHONE NUMBER INPUT
  // -------------------------------------------------------------
  const renderPhoneInput = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.phoneWrap}
    >
      <ScrollView contentContainerStyle={{ padding: 24, justifyContent: 'center' }}>
        <TouchableOpacity onPress={() => setScreen('welcome')} style={s.backBtnRow}>
          <Text style={s.backArrow}>← Back to Welcome</Text>
        </TouchableOpacity>

        <Text style={s.phoneTitle}>Enter your phone number</Text>
        <Text style={s.phoneSubtitle}>
          We'll send you an OTP for instant verification and case sync.
        </Text>

        <View style={s.phoneInputContainer}>
          <View style={s.countryCodeBox}>
            <Text style={s.countryCodeText}>🇮🇳 +91</Text>
          </View>
          <TextInput
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Enter 10-digit mobile number"
            placeholderTextColor="#64748b"
            keyboardType="phone-pad"
            maxLength={10}
            style={s.phoneTextInput}
          />
        </View>

        <Btn title="Send OTP →" onPress={handleSendOtp} style={{ marginTop: 18 }} />

        <TouchableOpacity onPress={handleContinueAsGuest} style={{ marginTop: 20, alignItems: 'center' }}>
          <Text style={s.guestAltLink}>Skip for demo: Continue as Guest</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // -------------------------------------------------------------
  // SCREEN: PHONE OTP VERIFICATION
  // -------------------------------------------------------------
  const renderPhoneOtp = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.phoneWrap}
    >
      <ScrollView contentContainerStyle={{ padding: 24, justifyContent: 'center' }}>
        <TouchableOpacity onPress={() => setScreen('phone_input')} style={s.backBtnRow}>
          <Text style={s.backArrow}>← Edit Number</Text>
        </TouchableOpacity>

        <Text style={s.phoneTitle}>Verify Phone Number</Text>
        <Text style={s.phoneSubtitle}>
          Enter the 6-digit verification code sent to +91 {phoneNumber || 'XXXXXXXXXX'}
        </Text>

        <View style={s.otpNoteCard}>
          <Text style={s.otpNoteText}>
            ℹ️ Demo Mode: Authentication interface preview. Tap "Verify & Continue" to enter the app.
          </Text>
        </View>

        <TextInput
          value={otpCode}
          onChangeText={setOtpCode}
          placeholder="• • • • • •"
          placeholderTextColor="#475569"
          keyboardType="number-pad"
          maxLength={6}
          style={s.otpInput}
        />

        <Btn title="Verify & Continue →" onPress={handleVerifyOtp} style={{ marginTop: 20 }} />

        <TouchableOpacity onPress={() => setScreen('phone_input')} style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={s.guestAltLink}>Didn't receive code? Resend OTP</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // -------------------------------------------------------------
  // SCREEN: MAIN KAYDA SATHI HOME ("What happened?")
  // -------------------------------------------------------------
  const renderHome = () => (
    <ScrollView contentContainerStyle={s.wrap}>
      {/* Top Bar with User State & Switch Option */}
      <View style={s.topBarRow}>
        <Text style={s.eyebrow}>TECKTONIX • KAYDA SATHI</Text>
        <TouchableOpacity onPress={handleLogout} style={s.userBadge}>
          <Text style={s.userBadgeText}>👤 {authState ? 'Guest' : 'Welcome'} • Switch</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.hero}>What happened?</Text>
      <Text style={s.sub}>
        Describe your problem in your own words. You don't need to know the legal terms.
      </Text>

      {/* Citizen Right of the Day Card */}
      <Card style={s.tipCard}>
        <View style={s.tipHeader}>
          <Text style={s.tipBadge}>💡 CITIZEN RIGHT OF THE DAY</Text>
          <TouchableOpacity onPress={nextTip} style={s.nextTipBtn}>
            <Text style={s.nextTipText}>Next Right ↻</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.tipTitle}>{currentRight.title}</Text>
        <Text style={s.tipBody}>{currentRight.fact}</Text>
        <Text style={s.tipLaw}>📜 Reference: {currentRight.law}</Text>
      </Card>

      {/* Language Selector */}
      <Card>
        <Text style={s.label}>PREFERRED LANGUAGE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {langs.map((x) => (
            <TouchableOpacity
              key={x}
              onPress={() => setLang(x)}
              style={[s.chip, lang === x && s.active]}
            >
              <Text style={s.chipText}>{x}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Location (Optional jurisdiction) */}
        <Text style={[s.label, { marginTop: 16 }]}>LOCATION / JURISDICTION (OPTIONAL)</Text>
        <View style={s.locRow}>
          <TextInput
            value={locationState}
            onChangeText={setLocationState}
            placeholder="State (e.g. Maharashtra)"
            placeholderTextColor="#64748b"
            style={[s.locInput, { marginRight: 8 }]}
          />
          <TextInput
            value={locationCity}
            onChangeText={setLocationCity}
            placeholder="City / District (e.g. Mumbai)"
            placeholderTextColor="#64748b"
            style={s.locInput}
          />
        </View>

        {/* Main Problem Input */}
        <Text style={[s.label, { marginTop: 16 }]}>DESCRIBE YOUR SITUATION</Text>
        <TextInput
          value={problem}
          onChangeText={setProblem}
          multiline
          placeholder="Example: My employer has not paid my salary for three months and keeps delaying..."
          placeholderTextColor="#64748b"
          style={s.input}
        />

        {/* Speech / Action Buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity
            onPress={toggleSpeechRecognition}
            style={[s.micBtn, isListening && s.micBtnActive]}
          >
            <Text style={s.micText}>{isListening ? '⏹ Listening...' : '🎤 Speak'}</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Btn
              title={loading ? 'Understanding...' : 'Analyze My Problem →'}
              onPress={() => analyze(problem)}
              disabled={loading}
            />
          </View>
        </View>

        {/* Example Scenarios */}
        <Text style={[s.label, { marginTop: 20 }]}>EXAMPLE SCENARIOS YOU CAN DESCRIBE</Text>
        <Text style={[s.bodySmall, { marginBottom: 8 }]}>
          These are only examples. You can describe any custom legal problem above.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {EXAMPLE_SCENARIOS.map((sample) => (
            <TouchableOpacity
              key={sample.tag}
              onPress={() => setProblem(sample.text)}
              style={s.sampleChip}
            >
              <Text style={s.sampleTag}>{sample.tag}</Text>
              <Text style={s.sampleText} numberOfLines={2}>
                {sample.text}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Card>

      {/* Safety & Helplines Card */}
      <Card>
        <Text style={s.title}>🛡️ Safety First & Emergency Helplines</Text>
        <Text style={s.body}>
          If you are facing immediate physical danger, threats of violence, or distress, dial 112 or contact the nearest police station immediately.
        </Text>
        <Btn title="View All Citizen Helplines" secondary onPress={() => setScreen('help')} />
      </Card>
    </ScrollView>
  );

  // -------------------------------------------------------------
  // SCREEN: 9-PART STRUCTURED INTAKE REPORT
  // -------------------------------------------------------------
  const renderCase = () => {
    if (!analysis) return null;

    const isUrgent = analysis.safety?.urgent;
    const completenessPct = analysis.completeness?.percentage || 50;

    return (
      <ScrollView contentContainerStyle={s.wrap}>
        {/* Source Header */}
        <View style={s.sourceRow}>
          <Text style={s.eyebrow}>LEGAL INTAKE REPORT</Text>
          <View style={s.sourceTag}>
            <Text style={s.sourceText}>{analysis.source || 'AI Intake Engine'}</Text>
          </View>
        </View>

        {/* Urgent Safety Warning Banner (If Triggered) */}
        {isUrgent && (
          <View style={s.safetyBanner}>
            <Text style={s.safetyTitle}>⚠️ URGENT SAFETY ALERT</Text>
            <Text style={s.safetyBody}>{analysis.safety?.warning}</Text>
            <View style={s.emergencyGrid}>
              {analysis.safety?.emergencyHelplines?.map((hl, idx) => (
                <View key={idx} style={s.emergencyPill}>
                  <Text style={s.emergencyName}>{hl.name}:</Text>
                  <Text style={s.emergencyNum}>{hl.number || hl.website}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* PART A: What We Understand */}
        <Card>
          <Text style={s.sectionHeader}>A. WHAT WE UNDERSTAND</Text>
          <Text style={s.body}>{analysis.understanding || problem}</Text>
        </Card>

        {/* PART B: Possible Legal Areas */}
        <Card>
          <Text style={s.sectionHeader}>B. POSSIBLE LEGAL AREAS</Text>
          <Text style={[s.bodySmall, { marginBottom: 10 }]}>
            Identified areas based on your facts (AI assessment, not definitive advice):
          </Text>
          {analysis.legalAreas?.map((area, idx) => (
            <View key={idx} style={s.domainItem}>
              <View style={s.domainHeader}>
                <Text style={s.domainName}>• {area.name}</Text>
                <View
                  style={[
                    s.relBadge,
                    area.relevance?.includes('High') ? s.relHigh : s.relMedium,
                  ]}
                >
                  <Text style={s.relText}>{area.relevance || 'Possible Relevance'}</Text>
                </View>
              </View>
              {area.reason && <Text style={s.domainReason}>{area.reason}</Text>}
            </View>
          ))}
        </Card>

        {/* PART C & D: Information Completeness & Follow-up Intake */}
        <Card>
          <View style={s.compHeader}>
            <Text style={s.sectionHeader}>C & D. INFORMATION COMPLETENESS</Text>
            <Text style={s.compPct}>{completenessPct}%</Text>
          </View>

          {/* Completeness Bar */}
          <View style={s.progressBarBg}>
            <View
              style={[
                s.progressBarFill,
                {
                  width: `${completenessPct}%`,
                  backgroundColor:
                    completenessPct >= 80 ? '#48bb78' : completenessPct >= 50 ? '#ecc94b' : '#ed8936',
                },
              ]}
            />
          </View>
          <Text style={[s.bodySmall, { marginBottom: 12 }]}>
            {analysis.completeness?.note}
          </Text>

          {/* Known Facts */}
          <Text style={s.subHeaderGreen}>✓ Facts Extracted from Your Story:</Text>
          {analysis.knownFacts?.map((fact, i) => (
            <Text key={i} style={s.factLine}>
              ✓ {fact}
            </Text>
          ))}

          {/* Missing Facts */}
          {analysis.missingFacts?.length > 0 && (
            <>
              <Text style={[s.subHeaderYellow, { marginTop: 14 }]}>
                ⚠ Information that Could Make Guidance More Specific:
              </Text>
              {analysis.missingFacts.map((m, i) => (
                <Text key={i} style={s.missingLine}>
                  • {m}
                </Text>
              ))}
            </>
          )}

          {/* Dynamic Follow-Up Questions */}
          {analysis.followUpQuestions?.length > 0 && (
            <View style={s.followUpBox}>
              <Text style={s.followUpTitle}>💬 Follow-up Intake Questions</Text>
              <Text style={[s.bodySmall, { marginBottom: 10 }]}>
                Answering these optional questions helps refine your legal action plan:
              </Text>

              {analysis.followUpQuestions.map((q) => (
                <View key={q.id} style={s.questionItem}>
                  <Text style={s.qText}>{q.question}</Text>
                  <Text style={s.qReason}>Why this matters: {q.reason}</Text>
                  <TextInput
                    value={followUpAnswers[q.id] || ''}
                    onChangeText={(txt) => handleFollowUpChange(q.id, txt)}
                    placeholder={q.placeholder || 'Type your answer...'}
                    placeholderTextColor="#64748b"
                    style={s.qInput}
                  />
                </View>
              ))}

              <Btn
                title={loading ? 'Updating...' : 'Refine Analysis with New Details ↻'}
                onPress={() => analyze(problem, followUpAnswers)}
                disabled={loading}
                style={{ marginTop: 8 }}
              />
            </View>
          )}
        </Card>

        {/* PART E: Possible Rights & Statutory Framework */}
        <Card>
          <Text style={s.sectionHeader}>E. POSSIBLE RIGHTS & LEGAL FRAMEWORK</Text>
          {analysis.rightsAndFrameworks?.map((rf, idx) => (
            <View key={idx} style={{ marginBottom: 12 }}>
              <Text style={s.frameworkTitle}>📜 {rf.framework}</Text>
              <Text style={s.body}>{rf.explanation}</Text>
              {rf.caution && <Text style={s.cautionText}>ℹ️ {rf.caution}</Text>}
            </View>
          ))}

          {analysis.possibleRights?.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={s.rightsSubTitle}>Your Possible Statutory Protections:</Text>
              {analysis.possibleRights.map((r, i) => (
                <Text key={i} style={s.rightsItem}>
                  ✓ {r}
                </Text>
              ))}
            </View>
          )}
        </Card>

        {/* PART F: What You Can Do Now (Action Plan) */}
        <Card>
          <Text style={s.sectionHeader}>F. WHAT YOU CAN DO NOW</Text>
          <Text style={[s.bodySmall, { marginBottom: 10 }]}>
            Recommended step-by-step practical action plan:
          </Text>
          {analysis.actionPlan?.map((step, i) => (
            <View key={i} style={s.stepRow}>
              <View style={s.stepBadge}>
                <Text style={s.stepNum}>{i + 1}</Text>
              </View>
              <Text style={s.stepText}>{step}</Text>
            </View>
          ))}
        </Card>

        {/* PART G: Evidence & Document Checklist */}
        <Card style={s.docCard}>
          <View style={s.docHeader}>
            <Text style={s.sectionHeader}>G. EVIDENCE & DOCUMENT CHECKLIST</Text>
            <View
              style={[
                s.badge,
                progressPercent === 100
                  ? s.badgeSuccess
                  : progressPercent > 0
                  ? s.badgeWarning
                  : s.badgeNeutral,
              ]}
            >
              <Text style={s.badgeText}>
                {verifiedCount}/{totalDocs} Verified ({progressPercent}%)
              </Text>
            </View>
          </View>
          <Text style={[s.bodySmall, { marginBottom: 12 }]}>
            Tap documents you have gathered. Verified items will be cited in your formal complaint draft.
          </Text>

          {analysis.documents?.map((doc) => {
            const isVerified = Boolean(verifiedDocs[doc.name]);
            return (
              <TouchableOpacity
                key={doc.name}
                onPress={() => toggleDoc(doc.name)}
                style={[s.docItem, isVerified && s.docItemActive]}
              >
                <View style={s.docRow}>
                  <View style={[s.checkbox, isVerified && s.checkboxChecked]}>
                    <Text style={s.checkMark}>{isVerified ? '✓' : ''}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.docName, isVerified && s.docNameActive]}>
                      {doc.name}
                    </Text>
                    <Text style={s.docSub}>
                      {doc.purpose || (isVerified ? 'Verified & ready for annexure' : 'Tap to mark as gathered')}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </Card>

        {/* PART H: Where to Go (Official Authorities & Helplines) */}
        <Card>
          <Text style={s.sectionHeader}>H. WHERE TO GO (OFFICIAL AUTHORITIES)</Text>
          {analysis.authorities?.map((auth, i) => (
            <View key={i} style={s.authItem}>
              <Text style={s.authName}>🏛️ {auth.name}</Text>
              <Text style={s.authPurpose}>{auth.purpose}</Text>
              {auth.phone && <Text style={s.authPhone}>📞 Helpline: {auth.phone}</Text>}
              {auth.website && <Text style={s.authLink}>🌐 Official Portal: {auth.website}</Text>}
            </View>
          ))}
        </Card>

        {/* Actions */}
        <View style={{ marginTop: 10, marginBottom: 20 }}>
          <Btn
            title={loading ? 'Generating...' : '📝 Generate Formal Notice / Complaint Draft →'}
            onPress={generateDraft}
            disabled={loading}
          />
          <Btn
            title="💾 Save Case to My Journey"
            secondary
            onPress={saveCurrentCase}
            style={{ marginTop: 10 }}
          />
          <Btn
            title="← Describe Another Problem"
            secondary
            onPress={() => setScreen('home')}
            style={{ marginTop: 10 }}
          />
        </View>
      </ScrollView>
    );
  };

  // -------------------------------------------------------------
  // SCREEN: DRAFT BUILDER
  // -------------------------------------------------------------
  const renderDraft = () => (
    <ScrollView contentContainerStyle={s.wrap}>
      <Text style={s.eyebrow}>CUSTOMIZABLE LEGAL DRAFT</Text>
      <Text style={s.heroSmall}>Formal Notice / Grievance</Text>
      <Text style={[s.bodySmall, { marginBottom: 14 }]}>
        Review and edit this draft before copying or sending. All verified documents have been automatically attached to the annexure schedule.
      </Text>

      <TextInput
        multiline
        value={draft}
        onChangeText={setDraft}
        style={[s.input, { minHeight: 460, textAlignVertical: 'top', fontSize: 14 }]}
      />

      <Btn
        title="✓ Copy / Ready to Use"
        onPress={() =>
          Alert.alert(
            'Draft Prepared',
            'You can copy this text and send it via email, registered post, or paste into the official portal.'
          )
        }
      />
      <Btn title="← Back to Intake Report" secondary onPress={() => setScreen('case')} />
    </ScrollView>
  );

  // -------------------------------------------------------------
  // SCREEN: MY CASES
  // -------------------------------------------------------------
  const renderCases = () => (
    <ScrollView contentContainerStyle={s.wrap}>
      <Text style={s.eyebrow}>MY LEGAL JOURNEY</Text>
      <Text style={s.heroSmall}>Saved Cases & Inquiries</Text>

      {cases.length > 0 ? (
        cases.map((c) => (
          <TouchableOpacity key={c.id} onPress={() => openSavedCase(c)}>
            <Card style={s.savedCaseCard}>
              <View style={s.savedCaseHeader}>
                <Text style={s.savedCaseTitle}>{c.title}</Text>
                <Text style={s.savedCaseDate}>{c.date}</Text>
              </View>
              <Text style={s.savedCaseProblem} numberOfLines={2}>
                "{c.problem}"
              </Text>
              <View style={s.savedCaseFooter}>
                <Text style={s.savedCaseBadge}>📊 {c.completeness}</Text>
                <Text style={s.openLink}>Reopen Case →</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      ) : (
        <Card>
          <Text style={s.body}>No cases saved yet. Analyze any problem from the Home screen to save it.</Text>
        </Card>
      )}
    </ScrollView>
  );

  // -------------------------------------------------------------
  // SCREEN: HELP & EMERGENCY DIRECTORY
  // -------------------------------------------------------------
  const renderHelp = () => (
    <ScrollView contentContainerStyle={s.wrap}>
      <Text style={s.eyebrow}>HELP & CITIZEN RESOURCES</Text>
      <Text style={s.heroSmall}>Official National Helplines</Text>

      <Card style={{ borderColor: '#e53e3e', borderWidth: 1 }}>
        <Text style={[s.title, { color: '#fc8181' }]}>🚨 112 — National Emergency Response</Text>
        <Text style={s.body}>
          Single emergency number across India for Police (100), Fire (101), and Medical Ambulance (108).
        </Text>
      </Card>

      <Card>
        <Text style={s.title}>💻 1930 — National Cyber Financial Helpline</Text>
        <Text style={s.body}>
          Immediate 24/7 hotline to freeze stolen funds and report online frauds, UPI scams, and digital blackmail.
        </Text>
        <Text style={s.link}>https://cybercrime.gov.in/</Text>
      </Card>

      <Card>
        <Text style={s.title}>⚖️ 15100 — NALSA Free Legal Aid</Text>
        <Text style={s.body}>
          National Legal Services Authority helpline providing 100% free advocate representation for eligible citizens under Article 39A.
        </Text>
        <Text style={s.link}>https://nalsa.gov.in/</Text>
      </Card>

      <Card>
        <Text style={s.title}>🛍️ 1915 — National Consumer Helpline</Text>
        <Text style={s.body}>
          Official grievance registration against defective goods, fraudulent sellers, overcharging, and e-commerce issues.
        </Text>
        <Text style={s.link}>https://consumerhelpline.gov.in/</Text>
      </Card>

      <Card>
        <Text style={s.title}>👩 1091 / 7827170170 — Women Safety & NCW</Text>
        <Text style={s.body}>
          National Commission for Women 24/7 helpline and Women Police emergency cell for domestic violence or harassment.
        </Text>
        <Text style={s.link}>http://ncw.nic.in/</Text>
      </Card>

      <Card>
        <Text style={s.title}>🎓 1800-180-5522 — UGC e-Samadhan & Anti-Ragging</Text>
        <Text style={s.body}>
          Official grievance redressal against certificate withholding, admission refund denials, and college disputes.
        </Text>
        <Text style={s.link}>https://samadhan.ugc.ac.in/</Text>
      </Card>
    </ScrollView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />

      {/* Screen Router */}
      {screen === 'welcome'
        ? renderWelcome()
        : screen === 'phone_input'
        ? renderPhoneInput()
        : screen === 'phone_otp'
        ? renderPhoneOtp()
        : screen === 'home'
        ? renderHome()
        : screen === 'case'
        ? renderCase()
        : screen === 'draft'
        ? renderDraft()
        : screen === 'cases'
        ? renderCases()
        : renderHelp()}

      {/* Bottom Navigation (Visible on Main Screens) */}
      {screen !== 'welcome' && screen !== 'phone_input' && screen !== 'phone_otp' && (
        <View style={s.nav}>
          <TouchableOpacity onPress={() => setScreen('home')} style={s.navItem}>
            <Text style={[s.navIcon, screen === 'home' && s.navIconActive]}>⌂</Text>
            <Text style={[s.navText, screen === 'home' && s.navTextActive]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('cases')} style={s.navItem}>
            <Text style={[s.navIcon, screen === 'cases' && s.navIconActive]}>▣</Text>
            <Text style={[s.navText, screen === 'cases' && s.navTextActive]}>My Cases</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('help')} style={s.navItem}>
            <Text style={[s.navIcon, screen === 'help' && s.navIconActive]}>⚖</Text>
            <Text style={[s.navText, screen === 'help' && s.navTextActive]}>Helplines</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// STYLES
// -------------------------------------------------------------
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#070b12' },
  wrap: { padding: 18, paddingBottom: 100 },

  // Welcome Screen Styles
  welcomeWrap: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  welcomeHeader: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  welcomeBadge: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  brandTagline: {
    color: '#93c5fd',
    fontSize: 15,
    fontWeight: '700',
    fontStyle: 'italic',
    marginTop: 2,
  },
  heroIllustrationBox: {
    width: '100%',
    maxWidth: 320,
    height: 240,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0c1527',
    borderWidth: 1.5,
    borderColor: '#1e3a5f',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  welcomeTextCard: {
    backgroundColor: '#0f1828',
    borderColor: '#1e293b',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    width: '100%',
    maxWidth: 380,
    marginBottom: 16,
    alignItems: 'center',
  },
  welcomeHeadline: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  welcomeSubText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  authCard: {
    backgroundColor: '#111b2d',
    borderColor: '#223554',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    width: '100%',
    maxWidth: 380,
  },
  getStartedLabel: {
    color: '#718096',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 12,
    textAlign: 'center',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  googleIcon: { fontSize: 16, marginRight: 10 },
  googleBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 14 },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 14,
  },
  phoneIcon: { fontSize: 16, marginRight: 8 },
  phoneBtnText: { color: '#f8fafc', fontWeight: '800', fontSize: 14 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#25354e',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 12,
  },
  guestBtn: {
    backgroundColor: '#192b45',
    borderColor: '#254570',
    borderWidth: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBtnText: { color: '#93c5fd', fontWeight: '900', fontSize: 14 },
  termsText: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 14,
  },

  // Phone Flow Styles
  phoneWrap: {
    flex: 1,
    backgroundColor: '#070b12',
    justifyContent: 'center',
  },
  backBtnRow: { marginBottom: 20 },
  backArrow: { color: '#60a5fa', fontWeight: '800', fontSize: 14 },
  phoneTitle: { color: '#ffffff', fontSize: 24, fontWeight: '900', marginBottom: 6 },
  phoneSubtitle: { color: '#94a3b8', fontSize: 14, lineHeight: 20, marginBottom: 20 },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1828',
    borderColor: '#223554',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  countryCodeBox: {
    backgroundColor: '#162338',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: '#223554',
  },
  countryCodeText: { color: '#f8fafc', fontWeight: '800', fontSize: 14 },
  phoneTextInput: {
    flex: 1,
    color: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  otpInput: {
    backgroundColor: '#0f1828',
    borderColor: '#223554',
    borderWidth: 1.5,
    borderRadius: 14,
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 8,
    paddingVertical: 14,
  },
  otpNoteCard: {
    backgroundColor: '#112239',
    borderColor: '#20436d',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  otpNoteText: { color: '#93c5fd', fontSize: 12, lineHeight: 17 },
  guestAltLink: { color: '#93c5fd', fontWeight: '800', fontSize: 13 },

  // Top bar
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  userBadge: {
    backgroundColor: '#172235',
    borderColor: '#2c3e5a',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  userBadgeText: { color: '#93c5fd', fontSize: 11, fontWeight: '800' },

  eyebrow: { color: '#7da8ff', fontWeight: '900', letterSpacing: 1.3, fontSize: 12 },
  hero: { color: '#fff', fontSize: 32, fontWeight: '900', lineHeight: 38, marginTop: 4 },
  heroSmall: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 6 },
  sub: { color: '#94a3b8', fontSize: 15, lineHeight: 22, marginVertical: 10 },
  body: { color: '#cbd5e1', fontSize: 14, lineHeight: 22 },
  bodySmall: { color: '#8292a8', fontSize: 12, lineHeight: 18 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  label: { color: '#718096', fontWeight: '900', fontSize: 11, letterSpacing: 1.1 },

  card: {
    backgroundColor: '#121824',
    borderColor: '#222f44',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },

  tipCard: {
    backgroundColor: '#111e33',
    borderColor: '#29436e',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  tipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tipBadge: { color: '#f6ad55', fontWeight: '900', fontSize: 11 },
  nextTipBtn: {
    backgroundColor: '#1d2f4d',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  nextTipText: { color: '#90cdf4', fontSize: 11, fontWeight: '800' },
  tipTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  tipBody: { color: '#cbd5e1', fontSize: 13, lineHeight: 19 },
  tipLaw: { color: '#4fd1c5', fontSize: 11, fontWeight: '800', marginTop: 6 },

  locRow: { flexDirection: 'row', marginTop: 8 },
  locInput: {
    flex: 1,
    backgroundColor: '#0a0e17',
    borderColor: '#222f44',
    borderWidth: 1,
    borderRadius: 10,
    color: '#fff',
    padding: 10,
    fontSize: 13,
  },

  input: {
    backgroundColor: '#0a0e17',
    borderColor: '#222f44',
    borderWidth: 1,
    borderRadius: 14,
    color: '#fff',
    padding: 14,
    minHeight: 120,
    marginTop: 8,
    fontSize: 15,
    textAlignVertical: 'top',
  },

  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  micBtn: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  micText: { color: '#94a3b8', fontWeight: '800', fontSize: 13 },

  btn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1 },
  dangerBtn: { backgroundColor: '#dc2626' },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 14 },

  chip: {
    borderWidth: 1,
    borderColor: '#2a3b53',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginTop: 8,
  },
  active: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  chipText: { color: '#e2e8f0', fontWeight: '800', fontSize: 12 },

  sampleChip: {
    backgroundColor: '#172030',
    borderColor: '#25354e',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginRight: 10,
    width: 220,
  },
  sampleTag: { color: '#60a5fa', fontSize: 12, fontWeight: '900', marginBottom: 4 },
  sampleText: { color: '#94a3b8', fontSize: 12, lineHeight: 17 },

  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sourceTag: {
    backgroundColor: '#1e293b',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sourceText: { color: '#94a3b8', fontSize: 10, fontWeight: '800' },

  safetyBanner: {
    backgroundColor: '#450a0a',
    borderColor: '#b91c1c',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  safetyTitle: { color: '#fca5a5', fontWeight: '900', fontSize: 14, marginBottom: 4 },
  safetyBody: { color: '#fee2e2', fontSize: 13, lineHeight: 19 },
  emergencyGrid: { marginTop: 10 },
  emergencyPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#7f1d1d',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  emergencyName: { color: '#fef2f2', fontWeight: '800', fontSize: 12 },
  emergencyNum: { color: '#fef08a', fontWeight: '900', fontSize: 12 },

  sectionHeader: { color: '#60a5fa', fontWeight: '900', fontSize: 12, letterSpacing: 1.2, marginBottom: 8 },
  domainItem: {
    backgroundColor: '#0c131f',
    borderColor: '#1e2c42',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  domainHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  domainName: { color: '#f1f5f9', fontWeight: '800', fontSize: 14, flex: 1 },
  domainReason: { color: '#8292a8', fontSize: 12, marginTop: 4 },
  relBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  relHigh: { backgroundColor: '#14532d' },
  relMedium: { backgroundColor: '#1e3a5f' },
  relText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  compHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compPct: { color: '#48bb78', fontWeight: '900', fontSize: 14 },
  progressBarBg: {
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    marginVertical: 8,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 3 },
  subHeaderGreen: { color: '#86efac', fontWeight: '800', fontSize: 12, marginBottom: 4 },
  subHeaderYellow: { color: '#fde047', fontWeight: '800', fontSize: 12, marginBottom: 4 },
  factLine: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, marginLeft: 4 },
  missingLine: { color: '#94a3b8', fontSize: 13, lineHeight: 19, marginLeft: 4 },

  followUpBox: {
    backgroundColor: '#0c1524',
    borderColor: '#1d3557',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  followUpTitle: { color: '#93c5fd', fontWeight: '900', fontSize: 13, marginBottom: 4 },
  questionItem: { marginBottom: 10 },
  qText: { color: '#f8fafc', fontWeight: '800', fontSize: 13 },
  qReason: { color: '#718096', fontSize: 11, marginVertical: 2 },
  qInput: {
    backgroundColor: '#070c14',
    borderColor: '#20324b',
    borderWidth: 1,
    borderRadius: 8,
    color: '#fff',
    padding: 8,
    fontSize: 13,
    marginTop: 4,
  },

  frameworkTitle: { color: '#38bdf8', fontWeight: '900', fontSize: 14, marginBottom: 2 },
  cautionText: { color: '#94a3b8', fontSize: 11, fontStyle: 'italic', marginTop: 4 },
  rightsSubTitle: { color: '#e2e8f0', fontWeight: '800', fontSize: 12, marginBottom: 4 },
  rightsItem: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, marginBottom: 3 },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  stepBadge: {
    backgroundColor: '#1d4ed8',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  stepNum: { color: '#fff', fontWeight: '900', fontSize: 11 },
  stepText: { color: '#e2e8f0', fontSize: 13, lineHeight: 20, flex: 1 },

  docCard: { backgroundColor: '#0f172a', borderColor: '#1e3a5f' },
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
  badgeNeutral: { backgroundColor: '#334155' },
  badgeWarning: { backgroundColor: '#854d0e' },
  badgeSuccess: { backgroundColor: '#15803d' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  docItem: {
    backgroundColor: '#090d16',
    borderColor: '#1e293b',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  docItemActive: { backgroundColor: '#06281e', borderColor: '#059669' },
  docRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#475569',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#10b981', borderColor: '#10b981' },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '900' },
  docName: { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },
  docNameActive: { color: '#6ee7b7' },
  docSub: { color: '#64748b', fontSize: 11, marginTop: 2 },

  authItem: {
    backgroundColor: '#090e18',
    borderColor: '#1e293b',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  authName: { color: '#fff', fontWeight: '800', fontSize: 14, marginBottom: 2 },
  authPurpose: { color: '#94a3b8', fontSize: 12, lineHeight: 17 },
  authPhone: { color: '#38bdf8', fontSize: 12, fontWeight: '700', marginTop: 4 },
  authLink: { color: '#60a5fa', fontSize: 12, fontWeight: '700', marginTop: 2 },

  savedCaseCard: { marginBottom: 10 },
  savedCaseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  savedCaseTitle: { color: '#60a5fa', fontWeight: '900', fontSize: 15, flex: 1 },
  savedCaseDate: { color: '#64748b', fontSize: 11 },
  savedCaseProblem: { color: '#cbd5e1', fontSize: 13, marginVertical: 6, fontStyle: 'italic' },
  savedCaseFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  savedCaseBadge: { color: '#86efac', fontSize: 11, fontWeight: '800' },
  openLink: { color: '#38bdf8', fontSize: 12, fontWeight: '800' },

  link: { color: '#60a5fa', fontWeight: '800', fontSize: 13, marginTop: 4 },

  nav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: '#0a0e17',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: { alignItems: 'center' },
  navIcon: { color: '#64748b', fontSize: 20 },
  navIconActive: { color: '#60a5fa' },
  navText: { color: '#64748b', fontWeight: '800', fontSize: 11, marginTop: 2 },
  navTextActive: { color: '#60a5fa' },
});
