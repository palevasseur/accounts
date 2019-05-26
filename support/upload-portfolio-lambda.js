const aws = require('aws-sdk');
const AdmZip = require('adm-zip');

const bucket = 'accountsapp-build.cg-palevasseur75';
const key = 'accountsapp.zip';
const codepipeline = new aws.CodePipeline({apiVersion: '2015-07-09'})

exports.handler = async function(event, context) {
  const jobId = event["CodePipeline.job"].id;
  try {
    // get zip file
    const s3 = new aws.S3({ apiVersion: '2006-03-01' });
    const inputFile = await s3.getObject({
      Bucket: bucket,
      Key: key,
    }).promise();

    // unzip content in the same
    const inputZip = new AdmZip(inputFile.Body);
    const entries = inputZip.getEntries();
    let bucketsList = [];
    entries.forEach((entry) => {
      console.log('Found entry ' + entry.entryName);
      const params = {
        Bucket: bucket,
        Key: entry.entryName,
        Body: entry.getData(),
        ContentType: 'content-type'
      };
      console.log('Creating file, params=', params);
      bucketsList.push(s3.putObject(params).promise());
    });

    // wait all promise before end
    await Promise.all(bucketsList);

    // propagate pipeline result
    await codepipeline.putJobSuccessResult({jobId}).promise();
  }
  catch (err) {
    /*console.log(err);
    const message = `Error getting object ${key} from bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function.`;
    console.log(message);
    throw new Error(message);*/
    const params = {
      jobId,
      failureDetails: {
        message: err.toString(),
        type: 'JobFailed',
        externalExecutionId: context.invokeid
      }
    };
    await codepipeline.putJobFailureResult(params).promise();
  }
};