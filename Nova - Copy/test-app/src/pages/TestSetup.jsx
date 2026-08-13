import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Initialize PDF.js worker using local file instead of CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const SUPABASE_URL = 'https://ldcfkvvxtpyttvvgkifp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_HwAwQKtYBC7TtjF_Lay_ow_huzi5H7x'; 

export default function TestSetup() {
  const [formData, setFormData] = useState({
    job_id: '',
    domain: ''
  });
  const [jobs, setJobs] = useState([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const fetchJobsInBatches = async () => {
      try {
        let allFetchedJobs = [];
        let offset = 0;
        const limit = 500;
        let hasMore = true;

        while (hasMore) {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?select=external_job_id,title,company&limit=${limit}&offset=${offset}`, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`
            }
          });
          
          if (!res.ok) throw new Error('Failed to fetch jobs');
          const data = await res.json();
          if (!isMounted) return;
          
          const formattedJobs = data.map(job => ({
            value: job.external_job_id,
            label: `${job.title} at ${job.company}`
          }));

          allFetchedJobs = [...allFetchedJobs, ...formattedJobs];
          setJobs([...allFetchedJobs]);
          
          if (data.length < limit) {
            hasMore = false;
          } else {
            offset += limit;
          }
        }

        const queryParams = new URLSearchParams(window.location.search);
        const urlJobId = queryParams.get('jobId');
        if (urlJobId && allFetchedJobs.some(j => j.value === urlJobId)) {
          setFormData(prev => ({ ...prev, job_id: urlJobId }));
        } else if (allFetchedJobs.length > 0) {
          setFormData(prev => ({ ...prev, job_id: allFetchedJobs[0].value }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setIsLoadingJobs(false);
      }
    };
    fetchJobsInBatches();
    return () => { isMounted = false; };
  }, []);

  const handleJobChange = (selectedOption) => {
    setFormData({ ...formData, job_id: selectedOption ? selectedOption.value : '' });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let extractedText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        extractedText += pageText + '\n\n';
      }

      setFormData(prev => ({ ...prev, domain: extractedText.trim() }));
    } catch (err) {
      console.error(err);
      setError('Failed to extract text from PDF.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const queryParams = new URLSearchParams(window.location.search);
    const isPractice = queryParams.get('practice') === 'true';
    navigate('/assessment', { state: { domain: formData.domain, job_id: formData.job_id, isPractice } });
  };

  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      background: 'var(--bg-color)',
      borderColor: state.isFocused ? 'var(--primary-color)' : 'var(--border-color)',
      color: 'var(--text-primary)',
      padding: '0.25rem',
      boxShadow: 'none',
      '&:hover': {
        borderColor: 'var(--primary-color)'
      }
    }),
    singleValue: (base) => ({ ...base, color: 'var(--text-primary)' }),
    input: (base) => ({ ...base, color: 'var(--text-primary)' }),
    menu: (base) => ({
      ...base,
      background: 'var(--surface-color)',
      border: '1px solid var(--border-color)',
      zIndex: 100
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? 'var(--surface-hover)' : 'transparent',
      color: 'var(--text-primary)',
      cursor: 'pointer',
      '&:active': { backgroundColor: 'var(--primary-color)' }
    })
  };

  return (
    <div className="panel max-w-md">
      <h2>Direct Test Evaluation</h2>
      <p>Select your job and upload your resume to generate a personalized test.</p>

      {error && <div className="badge danger" style={{display:'block', marginBottom:'1rem'}}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ marginTop: '2rem' }}>
        <div className="form-group">
          <label>Select Job {isLoadingJobs && <span style={{fontSize:'0.8rem', color:'var(--primary-color)'}}>(Loading...)</span>}</label>
          <Select
            options={jobs}
            value={jobs.find(j => j.value === formData.job_id)}
            onChange={handleJobChange}
            isLoading={isLoadingJobs}
            styles={customSelectStyles}
            placeholder="Search for a job..."
            isSearchable
            required
          />
        </div>

        <div className="form-group">
          <label>Upload Resume (PDF)</label>
          <input type="file" accept=".pdf" className="form-control" onChange={handleFileUpload} />
          {isExtracting && <small style={{color: 'var(--primary-color)'}}>Extracting text...</small>}
        </div>
        
        <div className="form-group">
          <label>Skill Domain / Context (Auto-filled from Resume)</label>
          <textarea 
            className="form-control" 
            placeholder="Upload a resume above to automatically fill this, or type your skills manually." 
            required 
            rows={5}
            value={formData.domain}
            onChange={(e) => setFormData({...formData, domain: e.target.value})}
          />
        </div>

        <button type="submit" className="btn" disabled={isLoadingJobs || isExtracting} style={{ width: '100%', marginTop: '1rem' }}>
          Start Assessment Now
        </button>
      </form>
    </div>
  );
}
