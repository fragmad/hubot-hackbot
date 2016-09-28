import { Robot } from 'hubot-slack';
import Config from '../config';

export default (robot: Robot) => {

  robot.error((err, response) => {
    const user = response.envelope.user;
    const fallback = `Error responding to message from @${user.name}
Command: ${response.message.text}
Error: ${err.message}`;
    const text = `Error responding to message from @${user.name}
\`\`\`
Command: ${response.message.text}
\`\`\`
\`\`\`
Error: ${err.stack}
\`\`\``;

    robot.send({ room: Config.HACKBOT_ERROR_CHANNEL.value }, {
      attachments: [{
        fallback: fallback,
        color: 'warning',
        title: `Hackbot error caught`,
        text: text,
        mrkdwn_in: ['text'],
      }],
    });

    if (response) {
      response.reply('Uhh, sorry, I just experienced an error :goberserk:');
    }
  });
};
