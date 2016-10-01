import { Robot } from 'hubot-slack';

export default (robot: Robot) => {

  robot.respond(/my id/i, (response) => {
    const userId = response.envelope.user.id;
    const dataStore = robot.adapter.client.rtm.dataStore;
    const user = dataStore.getUserById(userId);

    if (user) {
      const msg = JSON.stringify(user, null, 2);
      robot.send({ id: response.envelope.user.id }, {
        attachments: [{
          fallback: `\`\`\`${msg}\`\`\``,
          color: 'good',
          text: `\`\`\`${msg}\`\`\``,
          mrkdwn_in: ['text'],
        }],
      });
    } else {
      robot.send({ id: response.envelope.user.id }, `Could not find that user`);
    }
  });

  robot.respond(/whois (.+)/i, (response) => {
    const dataStore = robot.adapter.client.rtm.dataStore;

    const userId = response.envelope.user.id;
    if (!dataStore.getUserById(userId).is_admin) {
      return response.reply('Only admins can use the `whois` command');
    }

    const userName = response.match[1];
    const user = dataStore.getUserByName(userName);

    if (user) {
      const msg = JSON.stringify(user, null, 2);
      robot.send({ id: response.envelope.user.id }, {
        attachments: [{
          fallback: `\`\`\`${msg}\`\`\``,
          color: 'good',
          text: `\`\`\`${msg}\`\`\``,
          mrkdwn_in: ['text'],
        }],
      });
    } else {
      robot.send({ id: response.envelope.user.id }, `Could not find that user`);
    }
  });

};
