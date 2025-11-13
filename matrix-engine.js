// Matrix Engine - Core matrix operations library

class Matrix {
  constructor(rows, cols, data = null) {
    this.rows = rows;
    this.cols = cols;
    this.data = data || Array(rows).fill().map(() => Array(cols).fill(0));
  }

  // Create a copy of the matrix
  clone() {
    return new Matrix(this.rows, this.cols, this.data.map(row => [...row]));
  }

  // Get value at position
  get(i, j) {
    return this.data[i][j];
  }

  // Set value at position
  set(i, j, value) {
    this.data[i][j] = value;
  }

  // Convert to plain object for storage
  toJSON() {
    return {
      rows: this.rows,
      cols: this.cols,
      data: this.data
    };
  }

  // Create from plain object
  static fromJSON(json) {
    return new Matrix(json.rows, json.cols, json.data);
  }

  // Basic Operations

  add(other) {
    if (this.rows !== other.rows || this.cols !== other.cols) {
      throw new Error('Matrices must have the same dimensions for addition');
    }
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.set(i, j, this.get(i, j) + other.get(i, j));
      }
    }
    return result;
  }

  subtract(other) {
    if (this.rows !== other.rows || this.cols !== other.cols) {
      throw new Error('Matrices must have the same dimensions for subtraction');
    }
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.set(i, j, this.get(i, j) - other.get(i, j));
      }
    }
    return result;
  }

  scalarMultiply(scalar) {
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.set(i, j, this.get(i, j) * scalar);
      }
    }
    return result;
  }

  multiply(other) {
    if (this.cols !== other.rows) {
      throw new Error(`Cannot multiply: columns of first matrix (${this.cols}) must equal rows of second matrix (${other.rows})`);
    }
    const result = new Matrix(this.rows, other.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < other.cols; j++) {
        let sum = 0;
        for (let k = 0; k < this.cols; k++) {
          sum += this.get(i, k) * other.get(k, j);
        }
        result.set(i, j, sum);
      }
    }
    return result;
  }

  // Advanced Operations

  transpose() {
    const result = new Matrix(this.cols, this.rows);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.set(j, i, this.get(i, j));
      }
    }
    return result;
  }

  determinant() {
    if (this.rows !== this.cols) {
      throw new Error('Determinant only defined for square matrices');
    }
    return this._determinantRecursive(this.data);
  }

  _determinantRecursive(matrix) {
    const n = matrix.length;

    if (n === 1) return matrix[0][0];
    if (n === 2) {
      return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
    }

    let det = 0;
    for (let j = 0; j < n; j++) {
      const subMatrix = [];
      for (let i = 1; i < n; i++) {
        const row = [];
        for (let k = 0; k < n; k++) {
          if (k !== j) row.push(matrix[i][k]);
        }
        subMatrix.push(row);
      }
      det += Math.pow(-1, j) * matrix[0][j] * this._determinantRecursive(subMatrix);
    }
    return det;
  }

  inverse() {
    if (this.rows !== this.cols) {
      throw new Error('Inverse only defined for square matrices');
    }

    const det = this.determinant();
    if (Math.abs(det) < 1e-10) {
      throw new Error('Matrix is singular (determinant is zero)');
    }

    const n = this.rows;
    const augmented = [];

    // Create augmented matrix [A | I]
    for (let i = 0; i < n; i++) {
      augmented[i] = [];
      for (let j = 0; j < n; j++) {
        augmented[i][j] = this.get(i, j);
      }
      for (let j = 0; j < n; j++) {
        augmented[i][n + j] = (i === j) ? 1 : 0;
      }
    }

    // Gauss-Jordan elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }

      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      // Make diagonal 1
      const pivot = augmented[i][i];
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }

      // Eliminate column
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }

    // Extract inverse from augmented matrix
    const result = new Matrix(n, n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        result.set(i, j, augmented[i][n + j]);
      }
    }
    return result;
  }

  rank() {
    const matrix = this.data.map(row => [...row]);
    const m = this.rows;
    const n = this.cols;
    let rank = 0;

    for (let col = 0; col < n && rank < m; col++) {
      // Find pivot
      let pivotRow = -1;
      for (let row = rank; row < m; row++) {
        if (Math.abs(matrix[row][col]) > 1e-10) {
          pivotRow = row;
          break;
        }
      }

      if (pivotRow === -1) continue;

      // Swap rows
      [matrix[rank], matrix[pivotRow]] = [matrix[pivotRow], matrix[rank]];

      // Eliminate
      for (let row = rank + 1; row < m; row++) {
        const factor = matrix[row][col] / matrix[rank][col];
        for (let j = col; j < n; j++) {
          matrix[row][j] -= factor * matrix[rank][j];
        }
      }

      rank++;
    }

    return rank;
  }

  eigenvalues() {
    if (this.rows !== this.cols) {
      throw new Error('Eigenvalues only defined for square matrices');
    }

    // Using QR algorithm for eigenvalues (simplified version)
    // For educational purposes, this is a basic implementation
    const maxIterations = 100;
    const tolerance = 1e-10;
    let A = this.clone();

    for (let iter = 0; iter < maxIterations; iter++) {
      const QR = this._qrDecomposition(A);
      A = QR.R.multiply(QR.Q);

      // Check for convergence
      let offDiagonalSum = 0;
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          if (i !== j) {
            offDiagonalSum += Math.abs(A.get(i, j));
          }
        }
      }

      if (offDiagonalSum < tolerance) break;
    }

    // Extract diagonal elements as eigenvalues
    const eigenvalues = [];
    for (let i = 0; i < this.rows; i++) {
      eigenvalues.push(A.get(i, i));
    }

    return eigenvalues;
  }

  _qrDecomposition(A) {
    // Gram-Schmidt process
    const m = A.rows;
    const n = A.cols;
    const Q = new Matrix(m, n);
    const R = new Matrix(n, n);

    for (let j = 0; j < n; j++) {
      // Get column j from A
      let v = [];
      for (let i = 0; i < m; i++) {
        v.push(A.get(i, j));
      }

      // Orthogonalize against previous columns
      for (let k = 0; k < j; k++) {
        let dotProduct = 0;
        for (let i = 0; i < m; i++) {
          dotProduct += Q.get(i, k) * v[i];
        }
        R.set(k, j, dotProduct);

        for (let i = 0; i < m; i++) {
          v[i] -= dotProduct * Q.get(i, k);
        }
      }

      // Normalize
      let norm = 0;
      for (let i = 0; i < m; i++) {
        norm += v[i] * v[i];
      }
      norm = Math.sqrt(norm);
      R.set(j, j, norm);

      if (norm > 1e-10) {
        for (let i = 0; i < m; i++) {
          Q.set(i, j, v[i] / norm);
        }
      }
    }

    return { Q, R };
  }

  // Custom element-wise operation
  applyFunction(func) {
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.set(i, j, func(this.get(i, j), i, j));
      }
    }
    return result;
  }

  // Utility methods

  toString() {
    let str = '';
    for (let i = 0; i < this.rows; i++) {
      str += '[ ';
      for (let j = 0; j < this.cols; j++) {
        const val = this.get(i, j);
        str += (typeof val === 'number' ? val.toFixed(3) : val) + ' ';
      }
      str += ']\n';
    }
    return str;
  }

  static identity(n) {
    const matrix = new Matrix(n, n);
    for (let i = 0; i < n; i++) {
      matrix.set(i, i, 1);
    }
    return matrix;
  }

  static zeros(rows, cols) {
    return new Matrix(rows, cols);
  }

  static ones(rows, cols) {
    const matrix = new Matrix(rows, cols);
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        matrix.set(i, j, 1);
      }
    }
    return matrix;
  }
}
