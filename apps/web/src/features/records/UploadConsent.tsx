import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { policyVersions } from '@ovelo/validation';
import { get } from '../../lib/api';

export function useUploadConsent() {
  const [checked, setChecked] = useState(false);
  const policies = useQuery({
    queryKey: ['policy-consents'],
    queryFn: () => get<{ data: { accepted: { uploadProcessing: boolean } } }>('/auth/policies'),
    staleTime: 0,
  });
  const accepted = policies.data?.data.accepted.uploadProcessing === true;
  return {
    ready: !!policies.data && (accepted || checked),
    version: checked && !accepted ? policyVersions.uploadProcessing : undefined,
    refresh: () => policies.refetch(),
    acknowledgement: policies.error ? (
      <p role="alert">
        Could not check upload acknowledgement.{' '}
        <button type="button" className="text-button" onClick={() => void policies.refetch()}>
          Retry
        </button>
      </p>
    ) : policies.isPending ? (
      <p role="status">Checking upload acknowledgement…</p>
    ) : accepted ? null : (
      <label className="consent-row">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <span>
          I understand that files I upload are stored and processed by Ovelo as described in the{' '}
          <Link to="/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link to="/terms" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </Link>
          .
        </span>
      </label>
    ),
  };
}
