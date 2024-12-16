import { useEffect } from 'react';
import { jupiterDCA } from '../api/jupiter';

export const TestData = () => {
  useEffect(() => {
    const testData = async () => {
      try {
        console.log('Testing data fetch...');
        const data = await jupiterDCA.getDCAAccounts();
        console.log('Got data:', data);
      } catch (error) {
        console.error('Test failed:', error);
      }
    };

    testData();
  }, []);

  return <div>Check console for test results</div>;
}; 