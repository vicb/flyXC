/**
 * A simple linked-list based queue with O(1) enqueue/dequeue.
 * (Assuming memory alloc and object creation is O(1)...)
 */
export declare class Queue<T> {
  private _front;
  private _back;
  private _count;
  /**
   * Returns whether the queue is empty.
   */
  get empty(): boolean;
  /**
   * Returns the total number of items in the queue.
   */
  get count(): number;
  /**
   * Returns the item at the front of the queue without removing it.
   * Throws if the queue is empty.
   */
  get front(): T;
  /**
   * Adds an item to the back of the queue.
   */
  enqueue(item: T): void;
  /**
   * Removes an item from the front of the queue and returns it.
   * Throws if the queue is empty.
   */
  dequeue(): T;
}
