import { Request, Response, Router } from 'express';
import { encode } from '../waypoints/waypoints';

export function getWaypointRouter(): Router {
  const router = Router();

  // Generates a waypoint file.
  router.post('/download', (req: Request, res: Response) => {
    if (!req.body.request) {
      res.sendStatus(400);
    }
    // points elevations format prefix
    const { format, points, prefix } = JSON.parse(req.body.request);
    const { mime, file, filename, error } = encode(format, points, prefix);

    if (error) {
      res.redirect('back');
    } else {
      res.attachment(`${filename}`).set('Content-Type', mime).send(file);
    }
  });

  return router;
}
