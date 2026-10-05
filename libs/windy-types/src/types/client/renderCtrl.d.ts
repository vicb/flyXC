/**
 * Major render controller
 *
 * @module renderCtrl
 *
 * LIMITATION: The system is not ready for situation of ongoing tasks, when new UI event start new tasks
 */
import type { Renderers } from '@windy/Renderer';
/**
 * Identifiers of renderers used by the currently displayed overlay
 */
export declare function getActiveRenderers(): Renderers[];
