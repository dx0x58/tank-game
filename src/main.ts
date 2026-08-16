import './styles.css';
import { Game } from './core/Game';

const canvas = document.getElementById('scene');
const surface = document.getElementById('viewport');

if (!(canvas instanceof HTMLCanvasElement) || !(surface instanceof HTMLElement)) {
  throw new Error('Expected #scene canvas and #viewport container in the document');
}

new Game(canvas, surface).start();
