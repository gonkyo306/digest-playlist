// データの土台
// 曲取得の連続失敗を数え、しきい値（既定3回）に達したら「取得不能」とみなす。
// 対応基準: FR-4.15（3曲連続で失敗したら再生を止めてエラー表示。3曲未満はスキップして継続）

export class ConsecutiveFailureTracker {
  /** @param {number} threshold 連続失敗が何回に達したら停止と判定するか（既定3） */
  constructor(threshold = 3) {
    if (threshold < 1) throw new Error('threshold must be >= 1');
    this.threshold = threshold;
    this.count = 0;
  }

  /** 失敗を1件記録する。しきい値に達したら true を返す（＝停止すべき） */
  recordFailure() {
    this.count += 1;
    return this.isExhausted;
  }

  /** 成功を記録し、連続失敗カウントをリセットする */
  recordSuccess() {
    this.count = 0;
  }

  get isExhausted() {
    return this.count >= this.threshold;
  }
}
