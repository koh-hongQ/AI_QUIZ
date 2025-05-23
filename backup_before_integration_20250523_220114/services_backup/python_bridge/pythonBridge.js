import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Bridge service to communicate with Python scripts
 */
class PythonBridge {
  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.pythonScriptsPath = path.join(__dirname, '../../python_services');
    this.timeout = 30000; // 30 second timeout
  }

  /**
   * Execute a Python script with arguments
   * @param {string} scriptPath - Relative path to Python script
   * @param {Array} args - Arguments to pass to the script
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Script output
   */
  async executePythonScript(scriptPath, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const fullScriptPath = path.join(this.pythonScriptsPath, scriptPath);
      
      // Check if script exists
      if (!fs.existsSync(fullScriptPath)) {
        reject(new Error(`Python script not found: ${fullScriptPath}`));
        return;
      }

      const pythonProcess = spawn(this.pythonPath, [fullScriptPath, ...args], {
        env: { ...process.env, ...options.env },
        cwd: options.cwd || this.pythonScriptsPath
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // Try to parse JSON output
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (parseError) {
            // If not JSON, return raw output
            resolve({ output: stdout, raw: true });
          }
        } else {
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to execute Python script: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Python script execution timeout'));
      }, this.timeout);
    });
  }

  /**
   * Check if Python environment is properly configured
   * @returns {Promise<Object>} - Environment status
   */
  async checkPythonEnvironment() {
    try {
      // Check Python version
      const versionResult = await this.executePythonScript('../check_environment.py');
      return {
        available: true,
        ...versionResult
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }
}

export default PythonBridge;
