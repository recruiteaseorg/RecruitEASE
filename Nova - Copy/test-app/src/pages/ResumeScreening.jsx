import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Select from 'react-select';

// Initialize PDF.js worker using local file instead of CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const API_ENDPOINT = 'https://api.agents.snsihub.ai/webhook/74d45591-6cb2-4c63-92eb-4bd3751a80e8/recruitease';
const SUPABASE_URL = 'https://ldcfkvvxtpyttvvgkifp.supabase.co';
// Use the publishable key (browsers block the secret key via CORS)
const SUPABASE_KEY = 'sb_publishable_HwAwQKtYBC7TtjF_Lay_ow_huzi5H7x'; 

export default function ResumeScreening() {
  const [formData, setFormData] = useState({
    job_id: '',
    candidate_name: '',
    candidate_email: '',
    candidate_phone: '',
    resume_markdown: ''
  });
  const [jobs, setJobs] = useState([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
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

        if (allFetchedJobs.length > 0) {
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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

      setFormData(prev => ({ ...prev, resume_markdown: extractedText.trim() }));
    } catch (err) {
      console.error(err);
      setError('Failed to extract text from PDF.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resume_screening',
          job_id: formData.job_id,
          candidate_name: formData.candidate_name,
          candidate_email: formData.candidate_email,
          candidate_phone: formData.candidate_phone,
          resume_text: formData.resume_markdown
        })
      });

      const data = await response.json();
      
      let atsData = data.response || data.result || data;
      
      // Sometimes AI builders return the JSON as a markdown string (e.g. ```json { ... } ```)
      if (typeof atsData === 'string') {
        try {
          let cleanJsonString = atsData.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          cleanJsonString = jsonrepair(cleanJsonString);
          atsData = JSON.parse(cleanJsonString);
        } catch (e) {
          console.error("Failed to parse ATS JSON string:", atsData, e);
        }
      }

      navigate('/ats-result', { state: { atsResult: atsData, job_id: formData.job_id } });

    } catch (err) {
      setError(err.message || 'An error occurred during screening.');
    } finally {
      setIsLoading(false);
    }
  };

  // Custom styles for react-select to match our dark theme
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
      <h1>RecruitEase</h1>
      <p>Submit your application and resume for screening.</p>

      {error && <div className="badge danger" style={{display:'block', marginBottom:'1rem'}}>{error}</div>}

      <form onSubmit={handleSubmit}>
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
          <label>Full Name</label>
          <input type="text" name="candidate_name" className="form-control" required onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" name="candidate_email" className="form-control" required onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Phone</label>
          <input type="tel" name="candidate_phone" className="form-control" required onChange={handleChange} />
        </div>
        
        <div className="form-group">
          <label>Upload Resume (PDF)</label>
          <input type="file" accept=".pdf" className="form-control" onChange={handleFileUpload} />
          {isExtracting && <small style={{color: 'var(--primary-color)'}}>Extracting text...</small>}
        </div>

        <div className="form-group">
          <label>Resume Markdown / Text (Auto-filled)</label>
          <textarea name="resume_markdown" className="form-control" required onChange={handleChange} value={formData.resume_markdown}></textarea>
        </div>
        
        <button type="submit" className="btn" disabled={isLoading || isLoadingJobs || isExtracting} style={{width: '100%'}}>
          {isLoading ? 'Processing Resume...' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
}
