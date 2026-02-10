'use client';
import { useState } from 'react';
import styles from './page.module.css';

export default function Home() {
  const [config, setConfig] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!config.trim()) {
      setError('Please paste a configuration to analyze');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      if (!response.ok) throw new Error('Analysis failed');
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError('Failed to analyze configuration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>AI-Assisted Cloud Config Risk Scanner</h1>
        <p>Paste AWS configuration text for AI-assisted review</p>
      </header>

      <main className={styles.main}>
        <textarea
          className={styles.textarea}
          placeholder="Paste AWS config here (IAM policy JSON, S3 config, Terraform, CloudFormation)..."
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          rows={12}
        />

        <button 
          className={styles.button} 
          onClick={handleAnalyze}
          disabled={loading}
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>

        {error && <div className={styles.error}>{error}</div>}

        {result && (
          <div className={styles.results}>
            <section className={styles.section}>
              <h2>Summary</h2>
              <p>{result.summary}</p>
            </section>

            <section className={styles.section}>
              <h2>Potential Risks</h2>
              {result.risks.length === 0 ? (
                <p>No obvious risks detected.</p>
              ) : (
                <ul className={styles.riskList}>
                  {result.risks.map((risk, i) => (
                    <li key={i} className={styles[risk.severity]}>
                      <span className={styles.severity}>{risk.severity}</span>
                      {risk.description}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.section}>
              <h2>Suggested Improvements</h2>
              {result.suggestions.length === 0 ? (
                <p>No specific suggestions at this time.</p>
              ) : (
                <ul>
                  {result.suggestions.map((suggestion, i) => (
                    <li key={i}>{suggestion}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <p>⚠️ This is an AI-assisted review for educational purposes. It does not guarantee security, compliance, or correctness.</p>
      </footer>
    </div>
  );
}
